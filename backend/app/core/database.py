import time
from typing import AsyncGenerator, List, Dict, Any, Optional
import libsql_client
from app.core.config import settings

def get_turso_url() -> str:
    """
    Normaliza la URL de Turso para asegurar comunicación sobre HTTPS en el cliente de Python.
    """
    url = settings.TURSO_DATABASE_URL
    if not url:
        raise ValueError("TURSO_DATABASE_URL no está configurada en las variables de entorno.")
    if url.startswith("libsql://"):
        return url.replace("libsql://", "https://", 1)
    return url

def get_turso_token() -> str:
    token = settings.TURSO_AUTH_TOKEN
    if not token:
        raise ValueError("TURSO_AUTH_TOKEN no está configurado en las variables de entorno.")
    return token

def create_db_client() -> libsql_client.Client:
    """
    Crea una nueva instancia del cliente asíncrono de Turso.
    """
    url = get_turso_url()
    token = get_turso_token()
    return libsql_client.create_client(url, auth_token=token)

async def get_db() -> AsyncGenerator[libsql_client.Client, None]:
    """
    Generador de contexto para inyección de dependencias en FastAPI.
    Garantiza el cierre seguro de la conexión al finalizar la solicitud.
    """
    client = create_db_client()
    try:
        yield client
    finally:
        await client.close()

def row_to_dict(row: libsql_client.Row, columns: List[str]) -> Dict[str, Any]:
    """
    Convierte una fila de libSQL a un diccionario estándar de Python.
    """
    return {columns[i]: row[i] for i in range(len(columns))}

def result_to_dicts(result_set: libsql_client.ResultSet) -> List[Dict[str, Any]]:
    """
    Convierte un ResultSet completo de libSQL a una lista de diccionarios.
    """
    columns = result_set.columns
    return [row_to_dict(row, columns) for row in result_set.rows]

async def check_database_health() -> Dict[str, Any]:
    """
    Verifica la conectividad real con Turso y mide la latencia de ida y vuelta.
    """
    t0 = time.perf_counter()
    client = create_db_client()
    try:
        result = await client.execute("SELECT 1 as ping")
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "connected": True,
            "latency_ms": latency_ms,
            "result": result.rows[0][0] if result.rows else 1,
            "error": None
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "connected": False,
            "latency_ms": latency_ms,
            "result": None,
            "error": str(e)
        }
    finally:
        await client.close()
