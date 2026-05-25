from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.conversacion import Conversacion
from app.models.mensaje import Mensaje
from app.models.hecho import Hecho
from app.models.document import Documento
from app.models.user import Usuario
from app.utils.dependencies import get_current_user
from app.services.ollama_service import generate_ollama_response

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    document_ids: Optional[List[int]] = []

@router.post("/")
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener o crear conversación del usuario
    conversacion = db.query(Conversacion).filter(
        Conversacion.usuario_id == current_user.id
    ).order_by(Conversacion.updated_at.desc()).first()
    if not conversacion:
        conversacion = Conversacion(usuario_id=current_user.id, titulo="Chat")
        db.add(conversacion)
        db.commit()
        db.refresh(conversacion)

    # Guardar mensaje del usuario
    user_msg = Mensaje(
        conversacion_id=conversacion.id,
        rol="user",
        contenido=request.message
    )
    db.add(user_msg)
    db.commit()

    # Recuperar hechos de los documentos seleccionados
    hechos_contexto = ""
    if request.document_ids:
        hechos = db.query(Hecho).filter(Hecho.documento_id.in_(request.document_ids)).all()
        if hechos:
            docs_hechos = {}
            for h in hechos:
                doc_id = h.documento_id
                if doc_id not in docs_hechos:
                    doc = db.query(Documento).filter(Documento.id == doc_id).first()
                    docs_hechos[doc_id] = {
                        "nombre": doc.nombre_original if doc else f"Doc {doc_id}",
                        "hechos": []
                    }
                docs_hechos[doc_id]["hechos"].append(f"{h.atributo}: {h.valor}")
            for doc_id, info in docs_hechos.items():
                hechos_contexto += f"\nDocumento '{info['nombre']}':\n" + "\n".join(info["hechos"]) + "\n"
        else:
            hechos_contexto = "No hay información de documentos aún. Sube algunos documentos para que pueda analizarlos."
    else:
        hechos_contexto = "No se han proporcionado documentos para analizar."

    # Construir historial
    history_text = "\n".join([f"{m.role}: {m.content}" for m in request.history[-5:]]) if request.history else ""

    full_prompt = f"""Eres un asistente experto en análisis de documentos empresariales. 
Contexto de documentos subidos:
{hechos_contexto}

Historial de la conversación:
{history_text}

Usuario: {request.message}
Asistente: Responde de manera clara y útil basándote en el contexto de los documentos proporcionados. Si la pregunta no tiene relación con los documentos, responde de forma general pero siempre intenta relacionar con el contexto disponible.
"""
    response = await generate_ollama_response(full_prompt)

    # Guardar respuesta del asistente
    assistant_msg = Mensaje(
        conversacion_id=conversacion.id,
        rol="assistant",
        contenido=response
    )
    db.add(assistant_msg)
    db.commit()

    return {"response": response}

@router.get("/history")
async def get_chat_history(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    conversacion = db.query(Conversacion).filter(
        Conversacion.usuario_id == current_user.id
    ).order_by(Conversacion.updated_at.desc()).first()
    if not conversacion:
        return {"messages": []}
    mensajes = db.query(Mensaje).filter(
        Mensaje.conversacion_id == conversacion.id
    ).order_by(Mensaje.timestamp).all()
    return {
        "messages": [
            {"role": m.rol, "content": m.contenido, "timestamp": m.timestamp.isoformat()}
            for m in mensajes
        ]
    }