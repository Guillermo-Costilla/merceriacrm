import libsql_client
from typing import Optional, Dict, Any
from app.core.database import result_to_dicts

async def count_users(client: libsql_client.Client) -> int:
    rs = await client.execute("SELECT COUNT(*) FROM users")
    return int(rs.rows[0][0]) if rs.rows else 0

async def get_user_by_email(client: libsql_client.Client, email: str) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        """
        SELECT u.*, b.business_name, b.logo_data_url AS business_logo_data_url
        FROM users u
        JOIN businesses b ON b.id = u.business_id
        WHERE u.email = ? COLLATE NOCASE
        """,
        [email.strip().lower()]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_user_by_id(client: libsql_client.Client, user_id: str) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        """
        SELECT u.*, b.business_name, b.logo_data_url AS business_logo_data_url
        FROM users u
        JOIN businesses b ON b.id = u.business_id
        WHERE u.id = ?
        """,
        [user_id]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def create_business_account(
    client: libsql_client.Client,
    business_id: str,
    business_name: str,
    business_logo_data_url: Optional[str],
    user_id: str,
    email: str,
    password_hash: str,
    full_name: str
) -> Dict[str, Any]:
    await client.batch([
        libsql_client.Statement(
            "INSERT INTO businesses (id, business_name, logo_data_url) VALUES (?, ?, ?)",
            [business_id, business_name.strip(), business_logo_data_url]
        ),
        libsql_client.Statement(
            """
            INSERT INTO business_settings (
                id, business_name, report_title, currency_code, currency_symbol, timezone, contact_email
            ) VALUES (?, ?, 'Reporte de Gestión y Ventas', 'ARS', '$', 'America/Argentina/Tucuman', ?)
            """,
            [business_id, business_name.strip(), email.strip().lower()]
        ),
        libsql_client.Statement(
            """
            INSERT INTO users (id, business_id, email, password_hash, full_name, is_active, failed_login_attempts)
            VALUES (?, ?, ?, ?, ?, 1, 0)
            """,
            [user_id, business_id, email.strip().lower(), password_hash, full_name.strip()]
        )
    ])
    user = await get_user_by_id(client, user_id)
    return user # type: ignore

async def create_user(
    client: libsql_client.Client,
    user_id: str,
    business_id: str,
    email: str,
    password_hash: str,
    full_name: str
) -> Dict[str, Any]:
    await client.execute(
        """
        INSERT INTO users (id, business_id, email, password_hash, full_name, is_active, failed_login_attempts)
        VALUES (?, ?, ?, ?, ?, 1, 0)
        """,
        [user_id, business_id, email.strip().lower(), password_hash, full_name.strip()]
    )
    user = await get_user_by_id(client, user_id)
    return user # type: ignore

async def update_failed_login(
    client: libsql_client.Client,
    user_id: str,
    failed_attempts: int,
    locked_until: Optional[str]
) -> None:
    await client.execute(
        "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [failed_attempts, locked_until, user_id]
    )

async def reset_failed_login(client: libsql_client.Client, user_id: str) -> None:
    await client.execute(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [user_id]
    )

async def update_user_password(
    client: libsql_client.Client,
    user_id: str,
    new_password_hash: str
) -> None:
    await client.execute(
        "UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [new_password_hash, user_id]
    )

# ==================== SESIONES ====================

async def create_session(
    client: libsql_client.Client,
    session_id: str,
    user_id: str,
    token_hash: str,
    expires_at: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None
) -> None:
    await client.execute(
        """
        INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [session_id, user_id, token_hash, expires_at, user_agent, ip_address]
    )

async def get_session_with_user(
    client: libsql_client.Client,
    token_hash: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        """
        SELECT 
            s.id as session_id,
            s.expires_at,
            s.user_id,
            u.id as user_id,
            u.business_id,
            u.email,
            u.full_name,
            u.is_active,
            u.created_at,
            b.business_name,
            b.logo_data_url AS business_logo_data_url
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN businesses b ON b.id = u.business_id
        WHERE s.token_hash = ?
        """,
        [token_hash]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def delete_session(client: libsql_client.Client, token_hash: str) -> None:
    await client.execute("DELETE FROM sessions WHERE token_hash = ?", [token_hash])

async def delete_all_user_sessions(client: libsql_client.Client, user_id: str) -> None:
    await client.execute("DELETE FROM sessions WHERE user_id = ?", [user_id])

# ==================== RECUPERACIÓN DE CONTRASEÑA ====================

async def create_password_reset_token(
    client: libsql_client.Client,
    token_id: str,
    user_id: str,
    token_hash: str,
    expires_at: str
) -> None:
    # Invalidar tokens previos no usados del mismo usuario
    await client.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [user_id])
    await client.execute(
        """
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        [token_id, user_id, token_hash, expires_at]
    )

async def get_password_reset_token(
    client: libsql_client.Client,
    token_hash: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        "SELECT * FROM password_reset_tokens WHERE token_hash = ?",
        [token_hash]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def mark_password_reset_token_used(
    client: libsql_client.Client,
    token_id: str
) -> None:
    await client.execute(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
        [token_id]
    )
