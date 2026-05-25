from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text
from datetime import datetime
from app.core.database import Base

class Regla(Base):
    __tablename__ = "reglas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    condiciones_json = Column(JSON, nullable=False)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    creada_por = Column(Integer, ForeignKey("usuarios.id"))
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    activa = Column(Boolean, default=True)