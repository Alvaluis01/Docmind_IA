from app.core.database import SessionLocal
from app.models.rules import Regla
from app.models.user import Empresa, Usuario

db = SessionLocal()

empresa_default = db.query(Empresa).filter(Empresa.nit == "000000000").first()
if not empresa_default:
    empresa_default = Empresa(nombre="Empresa Default", nit="000000000")
    db.add(empresa_default)
    db.commit()
    db.refresh(empresa_default)

usuario_default = db.query(Usuario).filter(Usuario.email == "dev@docmind.ai").first()
if not usuario_default:
    usuario_default = Usuario(
        email="dev@docmind.ai",
        hashed_password="hash_de_devpass",  # reemplazar con hash real
        nombre_completo="Developer",
        empresa_id=empresa_default.id,
        rol="admin"
    )
    db.add(usuario_default)
    db.commit()
    db.refresh(usuario_default)

reglas = [
    ("Experiencia > 4 años", {"condiciones": [{"atributo": "experiencia_anos", "operador": ">", "valor": 4}], "puntaje": 10}),
    ("Sabe Python", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "python"}], "puntaje": 8}),
    ("Sabe Docker", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "docker"}], "puntaje": 5}),
    ("Sabe Kubernetes", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "kubernetes"}], "puntaje": 7}),
    ("Sabe AWS", {"condiciones": [{"atributo": "tecnologia", "operador": "contains", "valor": "aws"}], "puntaje": 6}),
]

for nombre, cond in reglas:
    existente = db.query(Regla).filter(Regla.nombre == nombre).first()
    if not existente:
        db.add(Regla(nombre=nombre, condiciones_json=cond, empresa_id=empresa_default.id, creada_por=usuario_default.id, activa=True))

db.commit()
db.close()
print("Reglas creadas correctamente.")