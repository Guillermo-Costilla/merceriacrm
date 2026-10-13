import libsql_client

from app.services import auth_service


async def create_test_business(
    client: libsql_client.Client,
    business_name: str,
    email: str,
    password: str,
    full_name: str,
) -> dict:
    user, _ = await auth_service.register_business(
        client=client,
        business_name=business_name,
        business_logo_data_url=None,
        email=email,
        password=password,
        full_name=full_name,
    )
    return user


async def cleanup_test_business(client: libsql_client.Client, business_id: str) -> None:
    await client.batch([
        libsql_client.Statement(
            "DELETE FROM inventory_movements WHERE business_id = ?",
            [business_id],
        ),
        libsql_client.Statement(
            """
            DELETE FROM sale_items
            WHERE sale_id IN (SELECT id FROM sales WHERE business_id = ?)
            """,
            [business_id],
        ),
        libsql_client.Statement("DELETE FROM sales WHERE business_id = ?", [business_id]),
        libsql_client.Statement("DELETE FROM products WHERE business_id = ?", [business_id]),
        libsql_client.Statement("DELETE FROM categories WHERE business_id = ?", [business_id]),
        libsql_client.Statement(
            "DELETE FROM password_reset_tokens WHERE user_id IN "
            "(SELECT id FROM users WHERE business_id = ?)",
            [business_id],
        ),
        libsql_client.Statement(
            "DELETE FROM sessions WHERE user_id IN "
            "(SELECT id FROM users WHERE business_id = ?)",
            [business_id],
        ),
        libsql_client.Statement("DELETE FROM users WHERE business_id = ?", [business_id]),
        libsql_client.Statement("DELETE FROM business_settings WHERE id = ?", [business_id]),
        libsql_client.Statement("DELETE FROM businesses WHERE id = ?", [business_id]),
    ])
