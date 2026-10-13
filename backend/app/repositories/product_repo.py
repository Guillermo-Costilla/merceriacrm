import libsql_client
from typing import List, Optional, Dict, Any, Tuple
from app.core.database import result_to_dicts

ALLOWED_SORT_COLUMNS = {
    "name": "p.name",
    "sku": "p.sku",
    "current_stock": "p.current_stock",
    "price_cents": "p.price_cents",
    "cost_cents": "p.cost_cents",
    "created_at": "p.created_at",
    "updated_at": "p.updated_at",
}

async def get_product_by_id(
    client: libsql_client.Client,
    business_id: str,
    product_id: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        """
        SELECT 
            p.*,
            c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.business_id = ? AND p.id = ?
        """,
        [business_id, product_id]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_product_by_sku(
    client: libsql_client.Client,
    business_id: str,
    sku: str
) -> Optional[Dict[str, Any]]:
    rs = await client.execute(
        """
        SELECT 
            p.*,
            c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.business_id = ? AND p.sku = ? COLLATE NOCASE
        """,
        [business_id, sku.strip().upper()]
    )
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def create_product(
    client: libsql_client.Client,
    product: Dict[str, Any]
) -> Dict[str, Any]:
    await client.execute(
        """
        INSERT INTO products (
            id, sku, name, category_id, description, cost_cents, price_cents,
            current_stock, min_stock, unit_of_measure, is_fractional, is_active, business_id
        ) VALUES (
            :id, :sku, :name, :category_id, :description, :cost_cents, :price_cents,
            :current_stock, :min_stock, :unit_of_measure, :is_fractional, :is_active, :business_id
        )
        """,
        product
    )
    res = await get_product_by_id(client, product["business_id"], product["id"])
    return res # type: ignore

async def update_product(
    client: libsql_client.Client,
    business_id: str,
    product_id: str,
    fields: Dict[str, Any]
) -> Dict[str, Any]:
    if not fields:
        res = await get_product_by_id(client, business_id, product_id)
        return res # type: ignore

    set_clauses = [f"{k} = :{k}" for k in fields.keys()]
    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE products SET {', '.join(set_clauses)} WHERE business_id = :business_id AND id = :id"
    
    params = {**fields, "business_id": business_id, "id": product_id}
    await client.execute(sql, params)
    res = await get_product_by_id(client, business_id, product_id)
    return res # type: ignore

async def set_product_active(
    client: libsql_client.Client,
    business_id: str,
    product_id: str,
    is_active: bool
) -> None:
    await client.execute(
        "UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?",
        [1 if is_active else 0, business_id, product_id]
    )

async def check_product_has_movements(
    client: libsql_client.Client,
    business_id: str,
    product_id: str
) -> bool:
    rs1 = await client.execute(
        "SELECT COUNT(*) FROM sale_items si JOIN products p ON p.id = si.product_id WHERE p.business_id = ? AND si.product_id = ?",
        [business_id, product_id]
    )
    if rs1.rows and rs1.rows[0][0] > 0:
        return True
    rs2 = await client.execute(
        "SELECT COUNT(*) FROM inventory_movements WHERE business_id = ? AND product_id = ?",
        [business_id, product_id]
    )
    if rs2.rows and rs2.rows[0][0] > 0:
        return True
    return False

async def delete_product_physical(
    client: libsql_client.Client,
    business_id: str,
    product_id: str
) -> None:
    await client.execute("DELETE FROM products WHERE business_id = ? AND id = ?", [business_id, product_id])

async def list_products(
    client: libsql_client.Client,
    business_id: str,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    stock_status: Optional[str] = None,
    is_active: Optional[bool] = None,
    order_by: str = "name",
    order_dir: str = "asc",
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    where_clauses = ["p.business_id = ?"]
    params: List[Any] = [business_id]

    if search:
        search_pattern = f"%{search.strip()}%"
        where_clauses.append("(p.name LIKE ? OR p.sku LIKE ?)")
        params.extend([search_pattern, search_pattern])

    if category_id:
        where_clauses.append("p.category_id = ?")
        params.append(category_id)

    if is_active is not None:
        where_clauses.append("p.is_active = ?")
        params.append(1 if is_active else 0)

    if stock_status == "low":
        where_clauses.append("p.current_stock <= p.min_stock AND p.current_stock > 0")
    elif stock_status == "out":
        where_clauses.append("p.current_stock = 0")
    elif stock_status == "in_stock":
        where_clauses.append("p.current_stock > 0")

    where_sql = " AND ".join(where_clauses)

    # 1. Conteo total de coincidencias
    count_sql = f"SELECT COUNT(*) FROM products p WHERE {where_sql}"
    rs_count = await client.execute(count_sql, params)
    total = int(rs_count.rows[0][0]) if rs_count.rows else 0

    # 2. Consulta paginada y ordenada de resultados
    sort_column = ALLOWED_SORT_COLUMNS.get(order_by.lower(), "p.name")
    sort_direction = "DESC" if order_dir.lower() == "desc" else "ASC"

    query_sql = f"""
        SELECT 
            p.*,
            c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE {where_sql}
        ORDER BY {sort_column} {sort_direction}
        LIMIT ? OFFSET ?
    """
    
    query_params = [*params, limit, offset]
    rs_items = await client.execute(query_sql, query_params)
    items = result_to_dicts(rs_items)

    return items, total
