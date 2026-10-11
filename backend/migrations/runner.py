import asyncio
import os
import sys
from pathlib import Path
from typing import List, Tuple
import libsql_client

# Asegurar importación de backend
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Configurar stdout para evitar fallos de codificación en consolas Windows (cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.core.database import create_db_client

MIGRATIONS_DIR = Path(__file__).resolve().parent

def parse_sql_statements(sql_content: str) -> List[str]:
    """
    Separa un archivo SQL en sentencias individuales válidas, ignorando comentarios de bloque y líneas vacías.
    """
    statements = []
    current_stmt = []
    
    for line in sql_content.splitlines():
        stripped = line.strip()
        # Ignorar comentarios de línea completa
        if stripped.startswith("--") or not stripped:
            continue
        current_stmt.append(line)
        if stripped.endswith(";"):
            stmt_text = "\n".join(current_stmt).strip()
            # Quitar punto y coma final para libsql_client si es necesario, o mantenerlo
            if stmt_text:
                statements.append(stmt_text)
            current_stmt = []
            
    if current_stmt:
        remaining = "\n".join(current_stmt).strip()
        if remaining:
            statements.append(remaining)
            
    return statements

async def run_migrations(dry_run: bool = False) -> None:
    """
    Ejecuta las migraciones pendientes contra la base de datos Turso.
    """
    print("\x1b[34m[Migraciones] Conectando a Turso...\x1b[0m")
    client = create_db_client()
    try:
        # 1. Asegurar tabla de control de migraciones
        await client.execute("""
            CREATE TABLE IF NOT EXISTS _schema_migrations (
                version TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
            )
        """)
        
        # 2. Consultar migraciones aplicadas
        applied_rs = await client.execute("SELECT version, name, applied_at FROM _schema_migrations ORDER BY version ASC")
        applied_versions = {row[0]: row[1] for row in applied_rs.rows}
        
        # 3. Descubrir archivos .sql en la carpeta de migraciones
        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        if not migration_files:
            print("\x1b[33m[Migraciones] No se encontraron archivos de migración .sql\x1b[0m")
            return

        pending_migrations: List[Tuple[str, str, Path]] = []
        for file_path in migration_files:
            name = file_path.stem
            version = name.split("_")[0]
            if version not in applied_versions:
                pending_migrations.append((version, name, file_path))
                
        if not pending_migrations:
            print(f"\x1b[32m[Migraciones] La base de datos está al día ({len(applied_versions)} migraciones aplicadas).\x1b[0m")
            return

        print(f"\x1b[33m[Migraciones] Se encontraron {len(pending_migrations)} migración(es) pendiente(s):\x1b[0m")
        for version, name, _ in pending_migrations:
            print(f"  - [{version}] {name}")
            
        if dry_run:
            print("\x1b[33m[Migraciones] Modo Dry-Run activado. No se aplicaron cambios.\x1b[0m")
            return

        # 4. Aplicar cada migración pendiente
        for version, name, file_path in pending_migrations:
            print(f"\x1b[36m[Migraciones] Aplicando {name}...\x1b[0m")
            sql_content = file_path.read_text(encoding="utf-8")
            statements = parse_sql_statements(sql_content)
            
            # Ejecutar sentencias en lote atómico mediante batch
            batch_statements = [libsql_client.Statement(stmt) for stmt in statements]
            # Agregar el registro de migración al mismo lote para garantizar atomicidad
            batch_statements.append(
                libsql_client.Statement(
                    "INSERT INTO _schema_migrations (version, name) VALUES (?, ?)",
                    [version, name]
                )
            )
            
            await client.batch(batch_statements)
            print(f"\x1b[32m[Migraciones] [OK] {name} aplicada exitosamente ({len(statements)} sentencias).\x1b[0m")
            
        print("\x1b[32m[Migraciones] Todas las migraciones fueron aplicadas con éxito.\x1b[0m")
        
    except Exception as e:
        print(f"\x1b[31m[Migraciones Error] Error al ejecutar migraciones: {e}\x1b[0m", file=sys.stderr)
        raise
    finally:
        await client.close()

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv or "--check" in sys.argv
    asyncio.run(run_migrations(dry_run=is_dry))
