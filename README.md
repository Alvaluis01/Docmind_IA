# 🧠 DocMind AI

> Plataforma web para análisis documental inteligente con motor de reglas configurable y asistente conversacional IA.

---

## 📋 Descripción general

DocMind AI permite subir documentos (CVs, hojas de vida), extraer hechos como años de experiencia y tecnologías, evaluarlos mediante un motor de reglas configurable, y obtener un puntaje y nivel de confianza. Incluye un asistente conversacional basado en Ollama (LLaMA 3.2 3B) y un panel de administración de reglas.

---

## ⚙️ Requisitos del sistema

| Herramienta | Versión requerida |
|-------------|-------------------|
| Python | 3.9, 3.10 o 3.11 *(estrictamente, por compatibilidad con bcrypt)* |
| Node.js | 18.x o superior (incluye npm) |
| Git | Opcional, para clonar el repositorio |
| Ollama | Opcional, solo para el chat IA |

---

## 🗂️ Estructura del proyecto

```
Docmind_AI/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py          # Endpoints principales (upload, documents, rules, stats)
│   │   ├── core/
│   │   │   └── database.py        # Configuración de SQLAlchemy y sesión
│   │   ├── extraction/
│   │   │   └── extractor.py       # Extracción de hechos de PDF/DOCX
│   │   ├── models/
│   │   │   ├── conversacion.py    # Modelo de conversaciones de chat
│   │   │   ├── document.py        # Modelo de documentos subidos
│   │   │   ├── hecho.py           # Hechos extraídos (nombre, experiencia, tecnologías)
│   │   │   ├── mensaje.py         # Mensajes del chat
│   │   │   ├── rules.py           # Reglas de evaluación
│   │   │   └── user.py            # Empresas y usuarios
│   │   ├── routers/
│   │   │   ├── auth.py            # Login y registro (JWT)
│   │   │   ├── chat.py            # Endpoints de chat
│   │   │   └── google_auth.py     # Login con Google
│   │   ├── rules/
│   │   │   └── engine.py          # Motor de reglas (evaluación de condiciones)
│   │   ├── services/
│   │   │   └── ollama_service.py  # Comunicación con Ollama (opcional)
│   │   ├── utils/
│   │   │   ├── auth.py            # Funciones de hash, JWT, get_current_user
│   │   │   ├── dependencies.py    # Dependencias comunes
│   │   │   └── schemas.py         # Esquemas Pydantic
│   │   └── main.py                # Punto de entrada de la aplicación FastAPI
│   ├── storage/                   # Directorio donde se guardan los archivos subidos
│   ├── .env                       # Variables de entorno del backend
│   └── docmind.db                 # Base de datos SQLite (se crea automáticamente)
└── frontend/
    ├── src/
    │   ├── App.tsx                # Componente principal React
    │   ├── main.tsx               # Punto de entrada del frontend
    │   └── index.css              # Estilos globales y tema oscuro/claro
    ├── .env                       # Variables de entorno del frontend
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Instalación paso a paso

### 1. Obtener el código

```bash
git clone https://github.com/tu-usuario/docmind-ai.git
cd docmind-ai
```

> También puedes descargar el ZIP y extraer la carpeta.

---

### 2. Backend (FastAPI)

#### 2.1 Crear y activar entorno virtual

```bash
cd backend
python -m venv .venv
```

```bash
# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

#### 2.2 Instalar dependencias exactas

```bash
pip install --upgrade pip
pip install fastapi==0.115.0
pip install uvicorn[standard]==0.30.0
pip install sqlalchemy==2.0.35
pip install python-jose[cryptography]==3.3.0
pip install passlib[bcrypt]==1.7.4
pip install python-multipart==0.0.12
pip install pdfplumber==0.11.0
pip install httpx==0.27.0
pip install google-auth==2.35.0
```

> **macOS — error con bcrypt:**
> ```bash
> pip uninstall bcrypt passlib -y
> pip install bcrypt==4.0.1 passlib==1.7.4
> ```

#### 2.3 Configurar variables de entorno

Crea el archivo `backend/.env`:

```env
DATABASE_URL=sqlite:///./docmind.db
SECRET_KEY=mi_clave_super_secreta_para_jwt
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OLLAMA_URL=http://localhost:11434
```

> ⚠️ En producción, reemplaza `SECRET_KEY` por una clave segura.

#### 2.4 Base de datos e inicialización

La primera ejecución del backend crea automáticamente:

- `docmind.db` con todas las tablas
- Empresa con NIT `000000000`
- Usuario administrador: `dev@docmind.ai` / `devpass`
- 9 reglas de ejemplo (experiencia y tecnologías)

No es necesario ejecutar comandos adicionales.

---

### 3. Frontend (React + Vite)

#### 3.1 Instalar dependencias

```bash
cd ../frontend
npm install
```

El `package.json` incluye:

```json
{
  "dependencies": {
    "@react-oauth/google": "^0.12.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "~5.6.2",
    "vite": "^5.4.10"
  }
}
```

#### 3.2 Configurar variables de entorno

Crea el archivo `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

#### 3.3 Configuración de Vite (opcional)

El archivo `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

---

### 4. Ollama para chat IA (opcional)

```bash
# Instalar desde https://ollama.com
ollama pull llama3.2:3b
```

Verificar que funciona:

```bash
curl http://localhost:11434/api/generate -d '{"model": "llama3.2:3b", "prompt": "Hola"}'
```

> Si no se instala Ollama, el chat devolverá un mensaje de error controlado.

---

## ▶️ Ejecución

### Terminal 1 — Backend

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

Salida esperada (primera ejecución):

```
✅ Empresa por defecto creada.
✅ Usuario admin creado (dev@docmind.ai / devpass).
✅ 9 reglas por defecto creadas.
INFO:     Application startup complete.
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

### Acceder a la aplicación

- URL: [http://localhost:5173](http://localhost:5173)
- Credenciales: `dev@docmind.ai` / `devpass`

---

## ✅ Verificación de funcionamiento

### Health check y login

```bash
# Health check
curl http://localhost:8000/health
# Respuesta: {"status":"ok"}

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@docmind.ai","password":"devpass"}'
```

### Probar análisis de un documento

Crea un archivo `prueba.txt` con el siguiente contenido exacto:

```
Juan Perez
Experiencia: 5 años
Tecnologías: Python, React, Docker
```

Súbelo desde la interfaz (pestaña **Análisis**). El documento mostrará puntaje, reglas activas y confianza (ejemplo: `18/15` y `98%`).

---

## 🔍 Explicación del código principal

### `extractor.py` — Extracción de hechos

Utiliza `pdfplumber` para extraer texto de PDFs, con fallback a lectura como texto plano. Busca nombre, experiencia (años) y tecnologías mediante expresiones regulares flexibles.

```python
exp_patterns = [
    r'(\d+)\s*años?\s+de\s+experiencia',
    r'experiencia\s+(?:de\s+)?(\d+)\s*años?',
    r'(\d+)\s*años?\s+de\s+(?:práctica|trabajo)',
    r'(\d+)\s*años?',
]
```

### `engine.py` — Motor de reglas

- `evaluar_condicion(hechos, atributo, operador, valor)`: soporta `>`, `>=`, `<`, `<=`, `==`, `contains`.
- `aplicar_reglas(hechos, reglas)`: itera sobre reglas activas y calcula `confianza = (score_total / max_score) * 100`.

Ejemplo de regla en JSON:

```json
{
  "condiciones": [{"atributo": "experiencia_anios", "operador": ">", "valor": 4}],
  "puntaje": 10
}
```

### `routes.py` — Endpoint `/upload`

1. Recibe el archivo y lo guarda en `storage/`
2. Llama a `extractor.py` para obtener hechos
3. Obtiene reglas activas de la base de datos
4. Ejecuta `aplicar_reglas` y devuelve JSON con `score`, `maxScore`, `activeRules`, `confidence`

### `utils/auth.py` — Autenticación JWT

- `get_password_hash` / `verify_password` usando `passlib[bcrypt]`
- `create_access_token`: genera JWT con expiración (30 min por defecto)
- `get_current_user`: decodifica token y retorna objeto `Usuario`

### `App.tsx` — Frontend

Maneja login/registro, subida de documentos, análisis, chat y rankings. Usa `fetch` con `Authorization: Bearer ${token}`. Los resultados se muestran en tarjetas con puntaje, reglas activas y confianza.

---

## 🛠️ Solución de problemas comunes

| Error | Causa y solución |
|-------|-----------------|
| `Address already in use` (puerto 8000) | Otro proceso usa el puerto. Usa `--port 8001` y actualiza `VITE_API_BASE_URL` en el frontend. |
| `ERR_CONNECTION_TIMED_OUT` | El backend no está corriendo. Ejecuta `uvicorn` según la sección de ejecución. |
| `401 Unauthorized` al subir archivo | Token JWT inválido o expirado. Cierra sesión, vuelve a iniciar y limpia `localStorage` (`F12 → Application → Local Storage → Clear`). |
| Análisis muestra `0/0` y confianza `0%` | Verifica que existan reglas activas (pestaña Admin). Los atributos deben ser `experiencia_anios` y `tecnologia` (sin tildes). El documento debe contener exactamente `"Experiencia:"` y `"Tecnologías:"`. |
| `Error 500` al subir archivo | Revisa logs del backend. Prueba con un `.txt` en lugar de PDF. Asegura que `storage/` tenga permisos de escritura. |
| Google Login da error `403` | Normal en desarrollo local. No afecta el login con email. Para eliminarlo, comenta `<GoogleLogin />` en `App.tsx`. |
| No se ven reglas en el panel Admin | Inicia sesión con un usuario admin (`dev@docmind.ai`). Si no aparecen, reinicia el backend. |

---

## 🔧 Comandos útiles para mantenimiento

**Reiniciar base de datos:**

```bash
rm backend/docmind.db
# Luego reinicia el backend
```

**Reinstalar dependencias del backend desde cero:**

```bash
pip uninstall -y -r <(pip freeze)
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart pdfplumber httpx google-auth
# En macOS: bcrypt==4.0.1 passlib==1.7.4
```

**Reconstruir frontend:**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 🌐 Ejemplos de uso de la API

**Login:**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@docmind.ai","password":"devpass"}'
```

**Subir documento (requiere token):**

```bash
curl -X POST http://localhost:8000/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/ruta/al/documento.pdf"
```

**Obtener documentos del usuario:**

```bash
curl -X GET http://localhost:8000/documents \
  -H "Authorization: Bearer <token>"
```

**Obtener reglas activas:**

```bash
curl -X GET http://localhost:8000/rules \
  -H "Authorization: Bearer <token>"
```

---

## 🧪 Código de ejemplo — Motor de reglas (pruebas unitarias)

```python
from app.rules.engine import aplicar_reglas
from app.models.hecho import Hecho
from app.core.database import SessionLocal
from app.models.rules import Regla

db = SessionLocal()
reglas = db.query(Regla).filter(Regla.activa == True).all()
hechos = [
    Hecho(atributo="experiencia_anios", valor="5"),
    Hecho(atributo="tecnologia", valor="python"),
]
resultado = aplicar_reglas(hechos, reglas)
print(resultado)
# Salida esperada: {'score_total': 18, 'max_score': 15, 'confianza': 98, ...}
db.close()
```

---

## ⚙️ Configuración de entorno de desarrollo

### Variables de entorno adicionales

| Variable | Descripción |
|----------|-------------|
| `OLLAMA_URL` | Por defecto `http://localhost:11434`. Cambia si Ollama corre en otra máquina. |
| `DATABASE_URL` | Soporta PostgreSQL: `postgresql://user:pass@localhost/dbname` |

### Modo producción

```bash
# Backend
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app

# Frontend
npm run build
serve -s dist   # o configurar nginx
```

---

## 📝 Notas adicionales

- El proyecto está configurado para ejecutarse completamente en local.
- No requiere conexión a internet después de instalar las dependencias *(excepto Ollama si se usa)*.
- Los puertos son configurables: backend (`--port`), frontend (`vite.config.ts`).
- SQLite es adecuado para desarrollo; en producción se recomienda **PostgreSQL**.
- El motor de reglas es completamente configurable desde el panel de administración.