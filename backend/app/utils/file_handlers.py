#  # backend/app/utils/file_handlers.py
# import os
# import uuid
# import shutil
# from typing import Optional
# from fastapi import UploadFile, HTTPException

# ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "csv", "txt"}
# MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# def save_upload_file(
#     upload_file: UploadFile,
#     base_dir: str = "storage",
#     allowed_extensions: Optional[set] = None,
#     max_size: int = MAX_FILE_SIZE
# ) -> str:
#     """
#     Guarda un archivo subido en el directorio especificado.
#     Genera un nombre único para evitar colisiones.
#     Valida extensión y tamaño.
    
#     Args:
#         upload_file: Archivo subido (FastAPI UploadFile)
#         base_dir: Directorio base donde guardar
#         allowed_extensions: Extensiones permitidas (por defecto las definidas)
#         max_size: Tamaño máximo en bytes

#     Returns:
#         Ruta absoluta del archivo guardado

#     Raises:
#         HTTPException 400 si la extensión no está permitida o el archivo es demasiado grande
#     """
#     # Validar extensión
#     ext = upload_file.filename.split('.')[-1].lower() if '.' in upload_file.filename else ''
#     allowed = allowed_extensions or ALLOWED_EXTENSIONS
#     if ext not in allowed:
#         raise HTTPException(
#             status_code=400,
#             detail=f"Extensión '{ext}' no permitida. Permitidas: {', '.join(allowed)}"
#         )
    
#     # Validar tamaño (leer solo los primeros bytes, sin cargar todo en memoria)
#     # Nota: UploadFile ya lee por partes, aquí solo comprobamos el content-length si está disponible
#     if upload_file.size and upload_file.size > max_size:
#         raise HTTPException(status_code=400, detail=f"Archivo demasiado grande. Máximo {max_size // (1024*1024)} MB")
    
#     # Crear directorio si no existe
#     os.makedirs(base_dir, exist_ok=True)
    
#     # Generar nombre único
#     unique_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
#     file_path = os.path.join(base_dir, unique_name)
    
#     # Guardar archivo
#     try:
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(upload_file.file, buffer)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error al guardar archivo: {str(e)}")
    
#     return file_path

# def delete_file(file_path: str) -> bool:
#     """
#     Elimina un archivo de forma segura.
    
#     Args:
#         file_path: Ruta del archivo a eliminar
    
#     Returns:
#         True si se eliminó correctamente, False si no existe o error
#     """
#     try:
#         if os.path.isfile(file_path):
#             os.remove(file_path)
#             return True
#         return False
#     except OSError:
#         return False

# def get_file_size(file_path: str) -> int:
#     """Retorna el tamaño del archivo en bytes, o 0 si no existe."""
#     try:
#         return os.path.getsize(file_path)
#     except OSError:
#         return 0

# def is_valid_file_type(filename: str, allowed_extensions: Optional[set] = None) -> bool:
#     """Verifica si la extensión del archivo está permitida."""
#     ext = filename.split('.')[-1].lower() if '.' in filename else ''
#     allowed = allowed_extensions or ALLOWED_EXTENSIONS
#     return ext in allowed