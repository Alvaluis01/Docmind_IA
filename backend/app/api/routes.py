import os
import uuid
import shutil
import re
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.document import Documento
from app.models.user import Usuario, Empresa
from app.models.rules import Regla   # <-- import correcta
from app.models.hecho import Hecho
from app.utils.auth import get_password_hash
from app.extraction.extractor import extraer_hechos_de_documento
from app.rules.engine import aplicar_reglas
from app.utils.dependencies import get_current_user
from app.services.ollama_service import summarize_analysis

router = APIRouter()

def save_upload_file(upload_file: UploadFile, base_dir: str = "storage") -> str:
    os.makedirs(base_dir, exist_ok=True)
    ext = upload_file.filename.split('.')[-1] if '.' in upload_file.filename else ''
    new_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
    file_path = os.path.join(base_dir, new_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return file_path

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    regla_ids: Optional[List[int]] = None,
    generate_summary: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    empresa_id = current_user.empresa_id
    user_id = current_user.id

    file_path = save_upload_file(file, base_dir="storage")
    nuevo_doc = Documento(
        nombre_original=file.filename,
        ruta_almacenamiento=file_path,
        empresa_id=empresa_id,
        subido_por=user_id,
        tipo=file.filename.split('.')[-1] if '.' in file.filename else '',
        tamano_bytes=os.path.getsize(file_path),
        procesado=False
    )
    db.add(nuevo_doc)
    db.commit()
    db.refresh(nuevo_doc)

    session_id = f"session_{nuevo_doc.id}_{user_id}"
    try:
        hechos = extraer_hechos_de_documento(db, nuevo_doc, session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en extracción: {str(e)}")

    # Obtener reglas
    if regla_ids:
        reglas = db.query(Regla).filter(
            Regla.id.in_(regla_ids),
            Regla.empresa_id == empresa_id,
            Regla.activa == True
        ).all()
    else:
        reglas = db.query(Regla).filter(
            Regla.empresa_id == empresa_id,
            Regla.activa == True
        ).all()

    # Fallback: si no hay reglas para esta empresa, usar las de la empresa por defecto (id=1)
    if not reglas:
        reglas = db.query(Regla).filter(Regla.empresa_id == 1, Regla.activa == True).all()

    try:
        resultados = aplicar_reglas(hechos, reglas)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al aplicar reglas: {str(e)}")

    score = sum(r.get("puntaje", 0) for r in resultados)
    nuevo_doc.score = score
    nuevo_doc.procesado = True
    db.commit()

    extracted_chars = sum(len(h.fuente) for h in hechos) if hechos else 0
    max_score = 15

    active_rules_map = {}
    for r in resultados:
        for line in r.get("justificacion", []):
            match = re.search(r"'([^']+)'\s*:\s*\+(\d+)", line)
            if match:
                rule_name = match.group(1)
                points = int(match.group(2))
                if rule_name not in active_rules_map:
                    active_rules_map[rule_name] = {"rule": rule_name, "points": points, "active": True}
    active_rules = list(active_rules_map.values())
    total_rules = len(reglas)

    if score == 0:
        confidence = 0
    else:
        porcentaje = (min(score, max_score) / max_score) * 100
        confidence = int(min(98, porcentaje))

    summary = None
    if generate_summary and hechos:
        hechos_texto = "\n".join([f"{h.entidad_nombre} - {h.atributo}: {h.valor}" for h in hechos[:20]])
        summary = await summarize_analysis(hechos_texto, score, max_score)

    return {
        "extractedChars": extracted_chars,
        "score": score,
        "maxScore": max_score,
        "activeRules": active_rules,
        "totalRules": total_rules,
        "confidence": confidence,
        "summary": summary,
        "documento_id": nuevo_doc.id,
        "nombre": nuevo_doc.nombre_original,
    }

# El resto de endpoints (GET /documents, /document/{doc_id}, /rules, /stats, etc.)
# se mantienen igual que en tu versión original. No es necesario cambiarlos.