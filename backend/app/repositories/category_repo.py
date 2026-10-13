import libsql_client
from typing import List, Optional, Dict, Any
from app.core.database import result_to_dicts

async def get_all_categories(client: libsql_client.Client, business_id: str) -> List[Dict[str, Any]]:
    rs = await client.execute(
        "SELECT * FROM categories WHERE business_id = ? AND is_active = 1 ORDER BY name ASC",
        [business_id]
    )
    return result_to_dicts(rs)

async def get_category_by_id(
    client: libsql_client.Client,
    business_id: str,
    category_id: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        "SELECT * FROM categories WHERE business_id = ? AND id = ?",
        [business_id, category_id]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_category_by_name(
    client: libsql_client.Client,
    business_id: str,
    name: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        "SELECT * FROM categories WHERE business_id = ? AND name = ? COLLATE NOCASE",
        [business_id, name.strip()]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def create_category(
    client: libsql_client.Client,
    business_id: str,
    category_id: str,
    name: str,
    description: Optional[str] = None
) -> Dict[str, Any]:
    await client.execute(
        "INSERT INTO categories (id, business_id, name, description, is_active) VALUES (?, ?, ?, ?, 1)",
        [category_id, business_id, name.strip(), description.strip() if description else None]
    )
    cat = await get_category_by_id(client, business_id, category_id)
    return cat # type: ignore
