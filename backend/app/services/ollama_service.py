import httpx
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

async def generate_ollama_response(prompt: str, system_prompt: str = None) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "top_p": 0.9}
        }
        if system_prompt:
            payload["system"] = system_prompt
        try:
            response = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()
        except Exception as e:
            print(f"Error en Ollama: {e}")
            return "El asistente no está disponible en este momento."

async def summarize_analysis(hechos_texto: str, score: int, max_score: int = 15) -> str:
    prompt = f"""Resume el siguiente análisis de documentos (puntaje {score}/{max_score}) en 2-3 frases profesionales para un gerente de RRHH:

Hechos extraídos:
{hechos_texto}

Redacta un veredicto claro y basado en los datos, destacando los puntos fuertes y débiles."""
    return await generate_ollama_response(prompt)