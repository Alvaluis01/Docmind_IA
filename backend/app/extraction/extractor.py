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
        try:
            with open(ruta, "rb") as f:
                raw = f.read()
                texto = raw.decode("utf-8", errors="ignore")
        except Exception as e2:
            print(f"Error en fallback: {e2}")
            return []

    if not texto.strip():
        print("No se pudo extraer texto.")
        return []

    texto = texto.replace('\n', ' ')
    print(f"📄 Texto extraído (primeros 300 chars): {texto[:300]}...")

    # Extraer nombre (simplificado)
    nombre_match = re.search(r'^([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)', texto)
    if not nombre_match:
        nombre_match = re.search(r'([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)', texto)
    nombre = nombre_match.group(1) if nombre_match else "Candidato"

    # Extraer experiencia
    exp_patterns = [
        r'(\d+)\s*años?\s+de\s+experiencia',
        r'experiencia\s*(?:laboral|profesional)?\s*:?\s*(\d+)\s*años?',
        r'(\d+)\s*años?\s+de\s+(?:práctica|trabajo)',
        r'(\d+)\s*años?',
    ]
    experiencia = None
    for pattern in exp_patterns:
        match = re.search(pattern, texto, re.IGNORECASE)
        if match:
            experiencia = int(match.group(1))
            break

    # Extraer tecnologías - VERSIÓN CORREGIDA
    tecnologias = set()

    # Buscar línea de tecnologías (patrón más preciso)
    tech_match = re.search(r'Tecnologías?:\s*(.+?)(?:\n|\.|$|Intereses|Experiencia|Perfil)', texto, re.IGNORECASE | re.DOTALL)
    if tech_match:
        raw = tech_match.group(1)
        # Dividir por saltos de línea, comas, puntos y espacios múltiples
        items = re.split(r'[\n,;•·]\s*', raw)
        for item in items:
            # Dividir también por espacios si hay múltiples palabras separadas
            sub_items = re.split(r'\s+', item.strip())
            for sub in sub_items:
                tech = sub.strip().lower()
                if tech and len(tech) > 1 and not any(stop in tech for stop in ['intereses', 'desarrollo', 'diseño', 'frontend', 'backend', 'ui/ux', 'estudiante', 'perfil']):
                    tecnologias.add(tech)
    else:
        # Si no encuentra "Tecnologías:", buscar "Herramientas:" u otros
        alt_match = re.search(r'(?:Herramientas|Skills|Habilidades|Conocimientos):\s*(.+?)(?:\n|\.|$|Experiencia)', texto, re.IGNORECASE | re.DOTALL)
        if alt_match:
            raw = alt_match.group(1)
            items = re.split(r'[\n,;•·]\s*', raw)
            for item in items:
                sub_items = re.split(r'\s+', item.strip())
                for sub in sub_items:
                    tech = sub.strip().lower()
                    if tech and len(tech) > 1:
                        tecnologias.add(tech)

    # Si aún no hay tecnologías, buscar palabras clave comunes
    if not tecnologias:
        common_tech = [
            'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'sql', 'mongodb',
            'postgresql', 'mysql', 'html', 'css', 'sass', 'tailwind', 'bootstrap',
            'node', 'express', 'django', 'flask', 'fastapi', 'spring', 'c#', '.net',
            'php', 'laravel', 'symfony', 'ruby', 'rails', 'go', 'rust', 'swift',
            'git', 'github', 'ci/cd', 'jenkins', 'terraform', 'ansible'
        ]
        texto_lower = texto.lower()
        for tk in common_tech:
            if re.search(r'\b' + re.escape(tk) + r'\b', texto_lower):
                tecnologias.add(tk)

    hechos = []

    # Hecho: nombre
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

    # Hecho: experiencia
    if experiencia is not None:
        h_exp = Hecho(
            session_id=session_id,
            documento_id=documento.id,
            entidad_nombre=nombre,
            atributo="experiencia_anios",
            valor=str(experiencia),
            fuente="extraccion",
            empresa_id=documento.empresa_id
        )
        db.add(h_exp)
        hechos.append(h_exp)
        print(f"   ✅ Experiencia detectada: {experiencia} años")
    else:
        print("   ⚠️ No se detectó experiencia")

    # Hecho: tecnologías
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
        print(f"   ✅ Tecnología detectada: {tech}")

    if not tecnologias:
        print("   ⚠️ No se detectaron tecnologías")

    db.commit()
    print(f"📦 Total hechos guardados: {len(hechos)}")
    return hechos