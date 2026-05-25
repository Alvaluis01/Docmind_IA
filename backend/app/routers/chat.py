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
    conversation_id: Optional[int] = None
    document_ids: Optional[List[int]] = []

@router.post("/")
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener o crear conversación
    if request.conversation_id:
        conversacion = db.query(Conversacion).filter(
            Conversacion.id == request.conversation_id,
            Conversacion.usuario_id == current_user.id
        ).first()
        if not conversacion:
            raise HTTPException(status_code=404, detail="Conversación no encontrada")
    else:
        conversacion = Conversacion(usuario_id=current_user.id, titulo="Nueva conversación")
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

    # Actualizar título si es el primer mensaje
    if conversacion.titulo == "Nueva conversación" and len(request.message) > 10:
        conversacion.titulo = request.message[:30] + ("..." if len(request.message) > 30 else "")
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

    # Construir historial (últimos 10 mensajes de esta conversación)
    mensajes_previos = db.query(Mensaje).filter(
        Mensaje.conversacion_id == conversacion.id
    ).order_by(Mensaje.timestamp.desc()).limit(10).all()
    history_text = "\n".join([f"{m.rol}: {m.contenido}" for m in reversed(mensajes_previos)]) if mensajes_previos else ""

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

    return {
        "response": response,
        "conversation_id": conversacion.id,
        "title": conversacion.titulo
    }

@router.get("/conversations")
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    convs = db.query(Conversacion).filter(
        Conversacion.usuario_id == current_user.id
    ).order_by(Conversacion.updated_at.desc()).all()
    return [{"id": c.id, "title": c.titulo, "created_at": c.created_at.isoformat()} for c in convs]

@router.get("/conversations/{conv_id}/messages")
async def get_conversation_messages(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    conv = db.query(Conversacion).filter(
        Conversacion.id == conv_id,
        Conversacion.usuario_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    mensajes = db.query(Mensaje).filter(
        Mensaje.conversacion_id == conv_id
    ).order_by(Mensaje.timestamp).all()
    return {
        "conversation_id": conv.id,
        "title": conv.titulo,
        "messages": [
            {"role": m.rol, "content": m.contenido, "timestamp": m.timestamp.isoformat()}
            for m in mensajes
        ]
    }

@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    conv = db.query(Conversacion).filter(
        Conversacion.id == conv_id,
        Conversacion.usuario_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    db.delete(conv)
    db.commit()
    return {"message": "Conversación eliminada"}