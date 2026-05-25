from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from datetime import datetime
from app.core.database import Base

class Hecho(Base):
    __tablename__ = "hechos"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    documento_id = Column(Integer, ForeignKey("documentos.id"))
    entidad_nombre = Column(String)
    atributo = Column(String)
    valor = Column(String)
    fuente = Column(String)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Índices adicionales para búsquedas rápidas
    __table_args__ = (
        Index('ix_hechos_entidad_nombre', 'entidad_nombre'),
        Index('ix_hechos_atributo', 'atributo'),
    )