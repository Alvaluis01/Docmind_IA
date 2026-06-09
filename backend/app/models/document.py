from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index, JSON
from datetime import datetime
from app.core.database import Base

class Documento(Base):
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    nombre_original = Column(String)
    ruta_almacenamiento = Column(String)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    subido_por = Column(Integer, ForeignKey("usuarios.id"))
    fecha_subida = Column(DateTime, default=datetime.utcnow)
    tipo = Column(String)
    tamano_bytes = Column(Integer, default=0)
    procesado = Column(Boolean, default=False)
    score = Column(Integer, default=0)
    active_rules = Column(JSON, default=[])  # Nuevo campo para almacenar reglas activas
    confidence = Column(Integer, default=0)  # Nuevo campo para confianza

    __table_args__ = (
        Index('ix_documentos_empresa_id', 'empresa_id'),
        Index('ix_documentos_subido_por', 'subido_por'),
        Index('ix_documentos_fecha_subida', 'fecha_subida'),
    )