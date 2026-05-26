from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy import JSON
from datetime import datetime
from app.core.database import Base

class Conversacion(Base):
    __tablename__ = "conversaciones"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    titulo = Column(String, default="Nueva conversación")
    # Lista de documentos asociados a la conversación (ids)
    document_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)