import pdfplumber
import re
from sqlalchemy.orm import Session
from app.models.document import Documento
from app.models.hecho import Hecho

def extraer_hechos_de_documento(db: Session, documento: Documento, session_id: str):
    """
    Extrae hechos (nombre, experiencia en años, tecnologías) de un PDF o DOCX.
    Retorna una lista de objetos Hecho guardados en la base de datos.
    """
    ruta = documento.ruta_almacenamiento
    texto = ""

    # 1. Extraer texto del documento
    try:
        with pdfplumber.open(ruta) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt:
                    texto += txt + "\n"
    except Exception as e:
        print(f"Error leyendo PDF con pdfplumber: {e}")
        # Intentar leer como archivo de texto plano (fallback)
        try:
            with open(ruta, "rb") as f:
                raw = f.read()
                texto = raw.decode("utf-8", errors="ignore")
        except Exception as e2:
            print(f"Error en fallback de texto plano: {e2}")
            return []

    if not texto.strip():
        print("No se pudo extraer texto del documento.")
        return []

    texto = texto.replace('\n', ' ')
    print(f"📄 Texto extraído (primeros 200 chars): {texto[:200]}...")

    # 2. Extraer nombre (asume un nombre al inicio del texto, dos palabras con mayúscula inicial)
    nombre_match = re.search(r'^([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)', texto)
    if not nombre_match:
        nombre_match = re.search(r'([A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+)', texto)
    nombre = nombre_match.group(1) if nombre_match else "Candidato"

<<<<<<< HEAD
    # 3. Extraer años de experiencia (patrones flexibles)
    exp_patterns = [
        r'(\d+)\s*años?\s+de\s+experiencia',
        r'experiencia\s+(?:de\s+)?(\d+)\s*años?',
        r'(\d+)\s*años?\s+de\s+(?:práctica|trabajo)',
        r'(\d+)\s*años?',
    ]
    experiencia = None
    for pattern in exp_patterns:
        match = re.search(pattern, texto, re.IGNORECASE)
        if match:
            experiencia = int(match.group(1))
            break

    # Si no se encontraron números, buscar palabras clave de nivel
    if experiencia is None:
        texto_lower = texto.lower()
        if re.search(r'(?:junior|entry|inicial|practicante)', texto_lower):
            experiencia = 1
        elif re.search(r'(?:senior|avanzado|líder|principal)', texto_lower):
            experiencia = 5
        elif re.search(r'(?:semi|intermedio|colaborador)', texto_lower):
            experiencia = 3

    # 4. Extraer tecnologías (múltiples patrones)
=======
    # Experiencia: atributo "experiencia_anos" (coincide con la regla)
    exp_match = re.search(r'Experiencia:\s*.*?(\d+)\s*años', texto, re.IGNORECASE | re.DOTALL)
    if not exp_match:
        exp_match = re.search(r'Experiencia:.*?(\d+)\s*años', texto, re.IGNORECASE | re.DOTALL)
    experiencia = int(exp_match.group(1)) if exp_match else None

    # Tecnologías: atributo "tecnologia"
    tech_line = re.search(r'Tecnologías:\s*(.+)', texto, re.IGNORECASE)
>>>>>>> 9c8b9e38f0a170af930a0af21493079adc7fe523
    tecnologias = set()
    # Buscar línea que comience con "Tecnologías:" o similares
    tech_line_match = re.search(r'(?:Tecnologías?|Habilidades|Skills):\s*(.+?)(?:\n|\.|$|Educación|Experiencia)', texto, re.IGNORECASE | re.DOTALL)
    if tech_line_match:
        raw = tech_line_match.group(1)
        # Limpiar y dividir por comas, puntos y comas
        items = re.split(r'[;,•·\n]\s*', raw)
        for item in items:
            tech = item.strip().lower()
            if tech and len(tech) > 1 and not any(stop in tech for stop in ['educación', 'experiencia', 'proyectos', 'contacto']):
                tecnologias.add(tech)
    else:
        # Si no hay línea específica, buscar palabras clave comunes en todo el texto
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

    # 5. Crear los hechos y guardarlos en la BD
    hechos = []
<<<<<<< HEAD

    # Hecho: nombre
=======
    # Nombre
>>>>>>> 9c8b9e38f0a170af930a0af21493079adc7fe523
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

<<<<<<< HEAD
    # Hecho: experiencia (si se encontró)
=======
    # Experiencia
>>>>>>> 9c8b9e38f0a170af930a0af21493079adc7fe523
    if experiencia is not None:
        h_exp = Hecho(
            session_id=session_id,
            documento_id=documento.id,
            entidad_nombre=nombre,
<<<<<<< HEAD
            atributo="experiencia_anios",
=======
            atributo="experiencia_anos",
>>>>>>> 9c8b9e38f0a170af930a0af21493079adc7fe523
            valor=str(experiencia),
            fuente="extraccion",
            empresa_id=documento.empresa_id
        )
        db.add(h_exp)
        hechos.append(h_exp)
        print(f"   ✅ Experiencia detectada: {experiencia} años")
    else:
        print("   ⚠️ No se detectó experiencia")

<<<<<<< HEAD
    # Hechos: tecnologías
=======
    # Tecnologías
>>>>>>> 9c8b9e38f0a170af930a0af21493079adc7fe523
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