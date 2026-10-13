import argparse
import asyncio
import getpass
import sys
from pathlib import Path
import libsql_client

# Asegurar importación del backend
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Configurar la salida para consolas Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

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

async def run_cleanup_legacy_business(dry_run: bool) -> bool:
    client = create_db_client()
    try:
        schema_result = await client.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        table_names = {str(row[0]) for row in schema_result.rows}
        if "_schema_migrations" not in table_names:
            print(
                "\x1b[31m[Cleanup Error] La base conectada no tiene el historial de migraciones "
                "requerido. No se modificó ningún dato.\x1b[0m",
                file=sys.stderr
            )
            return False

        migrations = await client.execute(
            "SELECT version, name FROM _schema_migrations ORDER BY version"
        )
        applied_migrations = {
            str(row[0]): str(row[1])
            for row in migrations.rows
        }
        expected_migration = "004_business_accounts"
        applied_name = applied_migrations.get("004")
        if applied_name is None:
            print(
                "\x1b[31m[Cleanup Error] Falta aplicar la migración "
                f"'{expected_migration}'. Ejecuta 'pnpm run migrate' antes de la limpieza. "
                "No se modificó ningún dato.\x1b[0m",
                file=sys.stderr
            )
            return False

        if applied_name != expected_migration:
            print(
                f"\x1b[31m[Cleanup Error] Historial de migraciones incompatible: "
                f"la versión 004 registrada es '{applied_name}', pero se requiere "
                f"'{expected_migration}'. No se modificó ningún dato. Alinea el esquema "
                "y el historial antes de continuar.\x1b[0m",
                file=sys.stderr
            )
            return False

        required_tables = {
            "businesses",
            "business_settings",
            "categories",
            "inventory_movements",
            "password_reset_tokens",
            "products",
            "product_change_log",
            "purchase_items",
            "purchases",
            "expenses",
            "operators",
            "owner_contributions",
            "registration_invites",
            "sale_items",
            "sales",
            "sessions",
            "users",
        }
        missing_tables = required_tables - table_names
        if missing_tables:
            missing_list = ", ".join(sorted(missing_tables))
            print(
                f"\x1b[31m[Cleanup Error] Faltan tablas requeridas por la limpieza: "
                f"{missing_list}. No se modificó ningún dato.\x1b[0m",
                file=sys.stderr
            )
            return False

        result = await client.execute(
            "SELECT business_name FROM businesses WHERE id = 'legacy-business'"
        )
        if not result.rows:
            print("\x1b[31m[Cleanup Error] No se encontró el comercio heredado.\x1b[0m", file=sys.stderr)
            return False

        business_name = str(result.rows[0][0])
        businesses = await client.execute(
            "SELECT COUNT(*) FROM businesses WHERE id != 'legacy-business'"
        )
        if not businesses.rows or int(businesses.rows[0][0]) < 1:
            print(
                "\x1b[31m[Cleanup Error] Registra primero el comercio del cliente; no se eliminaron datos.\x1b[0m",
                file=sys.stderr
            )
            return False

        count_queries = {
            "users": "SELECT COUNT(*) FROM users WHERE business_id = ?",
            "sessions": (
                "SELECT COUNT(*) FROM sessions WHERE user_id IN "
                "(SELECT id FROM users WHERE business_id = ?)"
            ),
            "password_reset_tokens": (
                "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id IN "
                "(SELECT id FROM users WHERE business_id = ?)"
            ),
            "categories": "SELECT COUNT(*) FROM categories WHERE business_id = ?",
            "products": "SELECT COUNT(*) FROM products WHERE business_id = ?",
            "sales": "SELECT COUNT(*) FROM sales WHERE business_id = ?",
            "sale_items": (
                "SELECT COUNT(*) FROM sale_items WHERE sale_id IN "
                "(SELECT id FROM sales WHERE business_id = ?)"
            ),
            "purchases": "SELECT COUNT(*) FROM purchases WHERE business_id = ?",
            "purchase_items": "SELECT COUNT(*) FROM purchase_items WHERE business_id = ?",
            "expenses": "SELECT COUNT(*) FROM expenses WHERE business_id = ?",
            "owner_contributions": "SELECT COUNT(*) FROM owner_contributions WHERE business_id = ?",
            "operators": "SELECT COUNT(*) FROM operators WHERE business_id = ?",
            "product_change_log": "SELECT COUNT(*) FROM product_change_log WHERE business_id = ?",
            "registration_invites": (
                "SELECT COUNT(*) FROM registration_invites WHERE business_id = ?"
            ),
            "inventory_movements": "SELECT COUNT(*) FROM inventory_movements WHERE business_id = ?",
            "business_settings": "SELECT COUNT(*) FROM business_settings WHERE id = ?",
        }
        counts = {}
        for table, query in count_queries.items():
            count_result = await client.execute(query, ["legacy-business"])
            counts[table] = int(count_result.rows[0][0]) if count_result.rows else 0

        print(f"[Cleanup] Espacio seleccionado: {business_name} (legacy-business)")
        for table, count in counts.items():
            print(f"  {table}: {count}")

        if dry_run:
            print("[Cleanup] Simulación; no se borró ningún dato.")
            return True

        confirmation = input(f"Escriba BORRAR {business_name} para eliminar todo este espacio: ")
        if confirmation != f"BORRAR {business_name}":
            print("[Cleanup] Confirmación incorrecta; no se borró ningún dato.", file=sys.stderr)
            return False

        await client.batch([
            libsql_client.Statement("DELETE FROM inventory_movements WHERE business_id = 'legacy-business'"),
            libsql_client.Statement(
                """
                DELETE FROM sale_items
                WHERE sale_id IN (SELECT id FROM sales WHERE business_id = 'legacy-business')
                """
            ),
            libsql_client.Statement("DELETE FROM purchase_items WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM product_change_log WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM sales WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM purchases WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM expenses WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM owner_contributions WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM operators WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM products WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM categories WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM registration_invites WHERE business_id = 'legacy-business'"),
            libsql_client.Statement(
                "DELETE FROM password_reset_tokens WHERE user_id IN "
                "(SELECT id FROM users WHERE business_id = 'legacy-business')"
            ),
            libsql_client.Statement(
                "DELETE FROM sessions WHERE user_id IN "
                "(SELECT id FROM users WHERE business_id = 'legacy-business')"
            ),
            libsql_client.Statement("DELETE FROM users WHERE business_id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM business_settings WHERE id = 'legacy-business'"),
            libsql_client.Statement("DELETE FROM businesses WHERE id = 'legacy-business'"),
        ])
        print(f"\x1b[32m[Cleanup] Se eliminó el comercio heredado {business_name} y todos sus datos.\x1b[0m")
        return True
    finally:
        await client.close()

def main():
    parser = argparse.ArgumentParser(description="CLI de Administración de Mercería CRM")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create-admin", help="Crea la cuenta del propietario")
    create_parser.add_argument("--email", help="Correo electrónico del administrador")
    create_parser.add_argument("--password", help="Contraseña segura (mínimo 8 caracteres)")
    create_parser.add_argument("--name", help="Nombre completo del propietario")

    cleanup_parser = subparsers.add_parser(
        "cleanup-legacy",
        help="Elimina el espacio heredado después de crear el comercio del cliente"
    )
    cleanup_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra los registros que se eliminarían sin modificar la base de datos"
    )

    args = parser.parse_args()

    if args.command == "cleanup-legacy":
        if not asyncio.run(run_cleanup_legacy_business(args.dry_run)):
            sys.exit(1)
        return

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
