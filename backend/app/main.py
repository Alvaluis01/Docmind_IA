from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.routes import router
from app.routers import auth, google_auth, chat
from app.core.database import engine, Base
from app.models.user import Empresa, Usuario
from app.models.rules import Regla
from app.models.hecho import Hecho
from app.models.document import Documento
from app.models.conversacion import Conversacion
from app.models.mensaje import Mensaje
from app.utils.auth import get_password_hash

# Crear tablas
Base.metadata.create_all(bind=engine)

# Inicializar datos por defecto
def init_db():
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        empresa = db.query(Empresa).filter(Empresa.nit == "000000000").first()
        if not empresa:
            empresa = Empresa(nombre="Empresa Default", nit="000000000")
            db.add(empresa)
            db.commit()
            db.refresh(empresa)
            print("✅ Empresa por defecto creada.")
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

app = FastAPI(title="DocMind AI API", version="1.0.0")

# ========== MIDDLEWARE CORS PERSONALIZADO (FORZAR) ==========
class ForceCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Manejar preflight OPTIONS
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
        # Procesar la solicitud y asegurarnos de añadir headers CORS incluso
        # si el handler lanza una excepción (evita respuestas 500 sin CORS).
        try:
            response = await call_next(request)
        except Exception as exc:
            # Construir una respuesta de error con headers CORS
            body = b"Internal Server Error"
            response = Response(content=body, status_code=500)
            response.headers["Content-Type"] = "text/plain"
        # Agregar headers CORS a la respuesta
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

# Aplicar el middleware personalizado primero
app.add_middleware(ForceCORSMiddleware)

# También añadir el middleware CORS estándar por si acaso
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(google_auth.router)

@app.get("/")
def root():
    return {"message": "DocMind AI funcionando"}