from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from app.core.database import get_db
from app.models.user import Usuario, Empresa
from app.utils.auth import create_access_token
import os

router = APIRouter(prefix="/auth", tags=["Autenticación"])

GOOGLE_CLIENT_ID = "866709837983-s0fmq490k4kfsqh3f49v7uo047gec23g.apps.googleusercontent.com"

@router.post("/google")
async def google_login(data: dict, db: Session = Depends(get_db)):
    credential = data.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Falta el token de Google")

    try:
        # Verificar el token con Google (sin necesidad de cliente secreto)
        info = id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        email = info["email"]
        nombre = info.get("name", email.split("@")[0])
    except Exception as e:
        print(f"Error verificando token: {e}")
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    # Buscar o crear usuario
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        # Crear empresa por defecto para el usuario
        empresa = Empresa(
            nombre=f"Empresa de {nombre}",
            nit=f"GOOGLE_{email[:10]}"
        )
        db.add(empresa)
        db.commit()
        db.refresh(empresa)
        usuario = Usuario(
            email=email,
            hashed_password="",  # No usamos contraseña para Google
            nombre_completo=nombre,
            empresa_id=empresa.id,
            rol="admin"
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

    # Generar nuestro propio JWT
    access_token = create_access_token(data={"sub": usuario.email, "empresa_id": usuario.empresa_id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"nombre": usuario.nombre_completo, "email": usuario.email}
    }