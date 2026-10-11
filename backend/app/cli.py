import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Asegurar importación del backend
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Configurar stdout para consolas Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.database import create_db_client
from app.services import auth_service
from app.services.auth_service import AuthError

async def run_create_admin(email: str, password: str, full_name: str) -> None:
    client = create_db_client()
    try:
        user = await auth_service.create_initial_admin(
            client=client,
            email=email,
            password=password,
            full_name=full_name
        )
        print(f"\x1b[32m[Admin CLI] [OK] Administrador creado exitosamente:\x1b[0m")
        print(f"  ID: {user['id']}")
        print(f"  Nombre: {user['full_name']}")
        print(f"  Correo: {user['email']}")
    except AuthError as e:
        print(f"\x1b[31m[Admin CLI Error] {e.message}\x1b[0m", file=sys.stderr)
        sys.exit(1)
    finally:
        await client.close()

def main():
    parser = argparse.ArgumentParser(description="CLI de Administración de Mercería CRM")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create-admin", help="Crea la cuenta del propietario")
    create_parser.add_argument("--email", help="Correo electrónico del administrador")
    create_parser.add_argument("--password", help="Contraseña segura (mínimo 8 caracteres)")
    create_parser.add_argument("--name", help="Nombre completo del propietario")

    args = parser.parse_args()

    if args.command == "create-admin":
        email = args.email
        if not email:
            email = input("Ingrese el correo electrónico del propietario: ").strip()

        full_name = args.name
        if not full_name:
            full_name = input("Ingrese el nombre completo del propietario: ").strip()

        password = args.password
        if not password:
            while True:
                password = getpass.getpass("Ingrese una contraseña segura (mín. 8 caracteres): ").strip()
                if len(password) < 8:
                    print("\x1b[31mLa contraseña debe tener al menos 8 caracteres.\x1b[0m")
                    continue
                confirm = getpass.getpass("Confirme la contraseña: ").strip()
                if password != confirm:
                    print("\x1b[31mLas contraseñas no coinciden. Intente de nuevo.\x1b[0m")
                    continue
                break

        if len(password) < 8:
            print("\x1b[31mError: La contraseña debe tener al menos 8 caracteres.\x1b[0m", file=sys.stderr)
            sys.exit(1)

        asyncio.run(run_create_admin(email, password, full_name))

if __name__ == "__main__":
    main()
