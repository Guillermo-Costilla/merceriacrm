import libsql_client
from typing import List, Optional, Dict, Any
from app.core.database import result_to_dicts

async def get_all_categories(client: libsql_client.Client) -> List[Dict[str, Any]]:
    rs = await client.execute("SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC")
    return result_to_dicts(rs)

async def get_category_by_id(client: libsql_client.Client, category_id: str) -> Optional[Dict[str, Any]]:
    rs = await client.execute("SELECT * FROM categories WHERE id = ?", [category_id])
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_category_by_name(client: libsql_client.Client, name: str) -> Optional[Dict[str, Any]]:
    rs = await client.execute("SELECT * FROM categories WHERE name = ? COLLATE NOCASE", [name.strip()])
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def create_category(
    client: libsql_client.Client,
    category_id: str,
    name: str,
    description: Optional[str] = None
) -> Dict[str, Any]:
    await client.execute(
        "INSERT INTO categories (id, name, description, is_active) VALUES (?, ?, ?, 1)",
        [category_id, name.strip(), description.strip() if description else None]
    )
    cat = await get_category_by_id(client, category_id)
    return cat # type: ignore
