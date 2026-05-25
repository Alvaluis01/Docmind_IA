import hashlib
from datetime import datetime, timedelta
from jose import jwt
from .config import settings
from . import schemas

def get_password_hash(password: str) -> str:
    """Hash SHA256 (solo para pruebas, no usar en producción real)"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        empresa_id: int = payload.get("empresa_id")
        if email is None:
            return None
        return schemas.TokenData(email=email, empresa_id=empresa_id)
    except jwt.JWTError:
        return None