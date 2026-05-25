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
from app.models.rules import Regla
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

@router.get("/documents")
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    docs = db.query(Documento).filter(Documento.empresa_id == current_user.empresa_id).all()
    return docs

@router.get("/document/{doc_id}")
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    doc = db.query(Documento).filter(
        Documento.id == doc_id,
        Documento.empresa_id == current_user.empresa_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc

@router.get("/rules")
async def get_rules(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    rules = db.query(Regla).filter(Regla.empresa_id == current_user.empresa_id).all()
    return [{"id": r.id, "nombre": r.nombre, "descripcion": r.descripcion, "condiciones_json": r.condiciones_json, "activa": r.activa} for r in rules]

@router.post("/rules")
async def create_rule(
    rule_data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    new_rule = Regla(
        nombre=rule_data["nombre"],
        descripcion=rule_data.get("descripcion"),
        condiciones_json=rule_data["condiciones_json"],
        empresa_id=current_user.empresa_id,
        creada_por=current_user.id,
        activa=rule_data.get("activa", True)
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return {"id": new_rule.id, "nombre": new_rule.nombre}

@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: int,
    rule_data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    rule = db.query(Regla).filter(Regla.id == rule_id, Regla.empresa_id == current_user.empresa_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    rule.nombre = rule_data.get("nombre", rule.nombre)
    rule.descripcion = rule_data.get("descripcion", rule.descripcion)
    rule.condiciones_json = rule_data.get("condiciones_json", rule.condiciones_json)
    rule.activa = rule_data.get("activa", rule.activa)
    db.commit()
    return {"message": "Regla actualizada"}

@router.delete("/documents/clear")
def delete_all_my_documents(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    docs = db.query(Documento).filter(Documento.empresa_id == current_user.empresa_id).all()
    for doc in docs:
        if os.path.exists(doc.ruta_almacenamiento):
            os.remove(doc.ruta_almacenamiento)
        db.delete(doc)
    db.commit()
    return {"message": "Todos los documentos han sido eliminados"}

@router.delete("/document/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    doc = db.query(Documento).filter(
        Documento.id == doc_id,
        Documento.empresa_id == current_user.empresa_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if os.path.exists(doc.ruta_almacenamiento):
        os.remove(doc.ruta_almacenamiento)
    db.delete(doc)
    db.commit()
    return {"message": "Documento eliminado"}

@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    total_docs = db.query(Documento).filter(Documento.empresa_id == current_user.empresa_id).count()
    total_rules = db.query(Regla).filter(Regla.empresa_id == current_user.empresa_id).count()
    total_users = db.query(Usuario).filter(Usuario.empresa_id == current_user.empresa_id).count()
    return {
        "total_documents": total_docs,
        "total_rules": total_rules,
        "total_users": total_users,
    }