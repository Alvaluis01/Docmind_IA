from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    empresa_id: Optional[int] = None

class UsuarioCreate(BaseModel):
    email: EmailStr
    password: str
    nombre_completo: str
    empresa_nombre: str
    empresa_nit: str

class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str

class UsuarioOut(BaseModel):
    id: int
    email: EmailStr
    nombre_completo: str
    rol: str
    empresa_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentoOut(BaseModel):
    id: int
    nombre_original: str
    fecha_subida: datetime
    procesado: bool

class ReglaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    condiciones_json: Dict[str, Any]

class ReglaOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str]
    condiciones_json: Dict[str, Any]
    activa: bool

class ExtraccionRequest(BaseModel):
    documento_ids: List[int]
    regla_ids: List[int]

class ResultadoExtraccion(BaseModel):
    empleado: str
    puntaje: int
    justificacion: List[str]