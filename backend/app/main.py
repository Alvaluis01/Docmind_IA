from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.routers import auth, google_auth, chat
from app.core.database import engine, Base
from app.models.user import Empresa, Usuario
from app.models.rules import Regla
from app.models.hecho import Hecho
from app.models.document import Documento
from app.models.conversacion import Conversacion   # nuevo
from app.models.mensaje import Mensaje             # nuevo
from app.utils.auth import get_password_hash

# Crear todas las tablas (incluyendo las nuevas)
Base.metadata.create_all(bind=engine)

# Inicializar datos por defecto (empresa, usuario admin, reglas)
def init_db():
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        # Empresa por defecto
        empresa = db.query(Empresa).filter(Empresa.nit == "000000000").first()
        if not empresa:
            empresa = Empresa(nombre="Empresa Default", nit="000000000")
            db.add(empresa)
            db.commit()
            db.refresh(empresa)
            print("✅ Empresa por defecto creada.")
        # Usuario admin por defecto
        user = db.query(Usuario).filter(Usuario.email == "dev@docmind.ai").first()
        if not user:
            user = Usuario(
                email="dev@docmind.ai",
                hashed_password=get_password_hash("devpass"),
                nombre_completo="Developer",
                empresa_id=empresa.id,
                rol="admin",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("✅ Usuario admin creado (dev@docmind.ai / devpass).")
        # Reglas por defecto
        if db.query(Regla).count() == 0:
            reglas_data = [
                ("Experiencia > 4 años", {"condiciones": [{"atributo": "experiencia_anios", "operador": ">", "valor": 4}], "puntaje": 10}),
                ("Sabe Python", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "python"}], "puntaje": 8}),
                ("Sabe Docker", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "docker"}], "puntaje": 5}),
                ("Sabe Kubernetes", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "kubernetes"}], "puntaje": 7}),
                ("Sabe AWS", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "aws"}], "puntaje": 6}),
            ]
            for nombre, cond in reglas_data:
                db.add(Regla(nombre=nombre, condiciones_json=cond, empresa_id=empresa.id, creada_por=user.id, activa=True))
            db.commit()
            print(f"✅ {len(reglas_data)} reglas por defecto creadas.")
    finally:
        db.close()

init_db()

# Crear la aplicación FastAPI
app = FastAPI(title="DocMind AI API", version="1.0.0")

# Configurar CORS: permitir orígenes específicos
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://salmonlike-collectively-zander.ngrok-free.dev",   # URL del frontend (ajústala)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir los routers
app.include_router(router)          # rutas principales (subida, documentos, admin, etc.)
app.include_router(auth.router)     # autenticación local (login/register)
app.include_router(chat.router)     # chat con IA y persistencia
app.include_router(google_auth.router)  # login con Google

# Endpoint raíz de verificación
@app.get("/")
def root():
    return {"message": "DocMind AI funcionando"}