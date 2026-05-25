from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime
from app.core.database import Base

class Mensaje(Base):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id"), nullable=False)
    rol = Column(String, nullable=False)  # "user" o "assistant"
    contenido = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)