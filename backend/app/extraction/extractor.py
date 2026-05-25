import pdfplumber
import re
from sqlalchemy.orm import Session
from app.models.document import Documento
from app.models.hecho import Hecho

def extraer_hechos_de_documento(db: Session, documento: Documento, session_id: str):
    ruta = documento.ruta_almacenamiento
    texto = ""

    try:
        with pdfplumber.open(ruta) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt:
                    texto += txt + "\n"
    except Exception as e:
        print(f"Error leyendo PDF: {e}")
        return []

    texto = texto.replace('\n', ' ')
    nombre_match = re.search(r'^([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)', texto)
    nombre = nombre_match.group(1) if nombre_match else "Desconocido"

    # Experiencia: atributo "experiencia_anos" (coincide con la regla)
    exp_match = re.search(r'Experiencia:\s*.*?(\d+)\s*años', texto, re.IGNORECASE | re.DOTALL)
    if not exp_match:
        exp_match = re.search(r'Experiencia:.*?(\d+)\s*años', texto, re.IGNORECASE | re.DOTALL)
    experiencia = int(exp_match.group(1)) if exp_match else None

    # Tecnologías: atributo "tecnologia"
    tech_line = re.search(r'Tecnologías:\s*(.+)', texto, re.IGNORECASE)
    tecnologias = set()
    if tech_line:
        raw = tech_line.group(1)
        for stopword in ["Educación", "Certificaciones", "Referencias"]:
            idx = raw.find(stopword)
            if idx != -1:
                raw = raw[:idx]
                break
        items = re.split(r'[,;]\s*', raw)
        for item in items:
            tech = item.strip().lower()
            if tech and len(tech) > 1 and not any(stop in tech for stop in ["educación", "certificaciones", "referencias"]):
                tecnologias.add(tech)
    else:
        common_tech = ['python', 'java', 'typescript', 'react', 'docker', 'sql', 'kubernetes', 'aws', 'fastapi']
        texto_lower = texto.lower()
        for tk in common_tech:
            if tk in texto_lower:
                tecnologias.add(tk)

    hechos = []
    # Nombre
    h_nom = Hecho(
        session_id=session_id,
        documento_id=documento.id,
        entidad_nombre=nombre,
        atributo="nombre",
        valor=nombre,
        fuente="extraccion",
        empresa_id=documento.empresa_id
    )
    db.add(h_nom)
    hechos.append(h_nom)

    # Experiencia
    if experiencia is not None:
        h_exp = Hecho(
            session_id=session_id,
            documento_id=documento.id,
            entidad_nombre=nombre,
            atributo="experiencia_anos",
            valor=str(experiencia),
            fuente="extraccion",
            empresa_id=documento.empresa_id
        )
        db.add(h_exp)
        hechos.append(h_exp)

    # Tecnologías
    for tech in tecnologias:
        h_tech = Hecho(
            session_id=session_id,
            documento_id=documento.id,
            entidad_nombre=nombre,
            atributo="tecnologia",
            valor=tech,
            fuente="extraccion",
            empresa_id=documento.empresa_id
        )
        db.add(h_tech)
        hechos.append(h_tech)

    db.commit()
    return hechos