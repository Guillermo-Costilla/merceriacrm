import libsql_client
from typing import List, Optional, Dict, Any, Tuple
from app.core.database import result_to_dicts

async def get_movement_by_id(
    client: libsql_client.Client,
    business_id: str,
    movement_id: str
) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT 
            m.*,
            p.name as product_name,
            p.sku as product_sku,
            p.unit_of_measure,
            u.full_name as created_by_user_name
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by_user_id = u.id
    WHERE m.business_id = ? AND m.id = ?
    """
    rs = await client.execute(sql, [business_id, movement_id])
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def list_movements(
    client: libsql_client.Client,
    business_id: str,
    product_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    where_clauses = ["m.business_id = ?"]
    params: List[Any] = [business_id]

    if product_id:
        where_clauses.append("m.product_id = ?")
        params.append(product_id)

    if movement_type:
        where_clauses.append("m.movement_type = ?")
        params.append(movement_type)

    if search:
        search_pattern = f"%{search.strip()}%"
        where_clauses.append("(p.name LIKE ? OR p.sku LIKE ? OR m.reason LIKE ?)")
        params.extend([search_pattern, search_pattern, search_pattern])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*)
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        WHERE {where_sql}
    """
    rs_count = await client.execute(count_sql, params)
    total = int(rs_count.rows[0][0]) if rs_count.rows else 0

    query_sql = f"""
        SELECT 
            m.*,
            p.name as product_name,
            p.sku as product_sku,
            p.unit_of_measure,
            u.full_name as created_by_user_name
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by_user_id = u.id
        WHERE {where_sql}
        ORDER BY m.created_at DESC, m.rowid DESC
        LIMIT ? OFFSET ?
    """
    query_params = [*params, limit, offset]
    rs_items = await client.execute(query_sql, query_params)
    items = result_to_dicts(rs_items)

    return items, total

async def get_reconciliation_audit(
    client: libsql_client.Client,
    business_id: str
) -> List[Dict[str, Any]]:
    """
    Calcula la suma algebraica de movimientos históricos para cada producto y la compara con current_stock.
    """
    sql = """
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.sku,
            p.unit_of_measure,
            p.current_stock,
            COALESCE(SUM(
                CASE 
                    WHEN m.movement_type IN ('PURCHASE_ENTRY', 'SALE_REVERSION', 'ADJUSTMENT_POSITIVE') THEN m.quantity
                    WHEN m.movement_type IN ('SALE_EXIT', 'ADJUSTMENT_NEGATIVE') THEN -m.quantity
                    ELSE 0.0
                END
            ), 0.0) as calculated_stock
        FROM products p
        LEFT JOIN inventory_movements m ON p.id = m.product_id
        WHERE p.business_id = ?
        GROUP BY p.id
        ORDER BY p.name ASC
    """
    rs = await client.execute(sql, [business_id])
    return result_to_dicts(rs)
