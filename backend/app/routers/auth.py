from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import Empresa, Usuario
from app.utils.auth import get_password_hash, verify_password, create_access_token
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Autenticación"])

class UsuarioCreate(BaseModel):
    email: str
    password: str
    nombre_completo: str
    empresa_nombre: str
    empresa_nit: str

class UsuarioLogin(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(user_data: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    empresa = Empresa(nombre=user_data.empresa_nombre, nit=user_data.empresa_nit)
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    hashed = get_password_hash(user_data.password)
    usuario = Usuario(
        email=user_data.email,
        hashed_password=hashed,
        nombre_completo=user_data.nombre_completo,
        empresa_id=empresa.id,
        rol="admin"
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    access_token = create_access_token(data={"sub": usuario.email, "empresa_id": usuario.empresa_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"nombre": usuario.nombre_completo, "email": usuario.email}
    }

@router.post("/login")
def login(login_data: UsuarioLogin, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == login_data.email).first()
    if not usuario or not verify_password(login_data.password, usuario.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    access_token = create_access_token(data={"sub": usuario.email, "empresa_id": usuario.empresa_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"nombre": usuario.nombre_completo, "email": usuario.email}
    }