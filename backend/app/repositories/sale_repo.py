import libsql_client
from typing import List, Optional, Dict, Any, Tuple
from app.core.database import result_to_dicts

async def get_next_sale_number(client: libsql_client.Client) -> int:
    rs = await client.execute("SELECT COALESCE(MAX(sale_number), 0) + 1 FROM sales")
    return int(rs.rows[0][0]) if rs.rows else 1

async def get_sale_by_id(client: libsql_client.Client, sale_id: str) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT 
            s.*,
            u.full_name as created_by_user_name
        FROM sales s
        LEFT JOIN users u ON s.created_by_user_id = u.id
        WHERE s.id = ?
    """
    rs = await client.execute(sql, [sale_id])
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_sale_by_idempotency_key(client: libsql_client.Client, key: str) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT 
            s.*,
            u.full_name as created_by_user_name
        FROM sales s
        LEFT JOIN users u ON s.created_by_user_id = u.id
        WHERE s.idempotency_key = ?
    """
    rs = await client.execute(sql, [key.strip()])
    rows = result_to_dicts(rs)
    return rows[0] if rows else None

async def get_sale_items(client: libsql_client.Client, sale_id: str) -> List[Dict[str, Any]]:
    sql = """
        SELECT 
            si.*,
            p.name as product_name,
            p.sku as product_sku
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
        ORDER BY si.rowid ASC
    """
    rs = await client.execute(sql, [sale_id])
    return result_to_dicts(rs)

async def list_sales(
    client: libsql_client.Client,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    where_clauses = ["1=1"]
    params: List[Any] = []

    # Filtrado por año y mes (interpretado en hora UTC o estándar ISO)
    if year and month:
        formatted_period = f"{year:04d}-{month:02d}"
        where_clauses.append("strftime('%Y-%m', s.sale_date) = ?")
        params.append(formatted_period)
    elif year:
        where_clauses.append("strftime('%Y', s.sale_date) = ?")
        params.append(f"{year:04d}")

    if status:
        where_clauses.append("s.status = ?")
        params.append(status.upper())

    if search:
        search_pattern = f"%{search.strip()}%"
        where_clauses.append("(CAST(s.sale_number AS TEXT) LIKE ? OR s.notes LIKE ?)")
        params.extend([search_pattern, search_pattern])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"SELECT COUNT(*) FROM sales s WHERE {where_sql}"
    rs_count = await client.execute(count_sql, params)
    total = int(rs_count.rows[0][0]) if rs_count.rows else 0

    query_sql = f"""
        SELECT 
            s.*,
            u.full_name as created_by_user_name
        FROM sales s
        LEFT JOIN users u ON s.created_by_user_id = u.id
        WHERE {where_sql}
        ORDER BY s.sale_date DESC, s.sale_number DESC
        LIMIT ? OFFSET ?
    """
    query_params = [*params, limit, offset]
    rs_items = await client.execute(query_sql, query_params)
    sales = result_to_dicts(rs_items)

    return sales, total

async def get_sales_export_rows(
    client: libsql_client.Client,
    year: int,
    month: int
) -> List[Dict[str, Any]]:
    period = f"{year:04d}-{month:02d}"
    sql = """
        SELECT
            s.id AS sale_id,
            s.sale_number,
            s.sale_date,
            s.total_cents,
            s.total_cost_cents,
            s.estimated_gross_profit_cents,
            s.status,
            s.cancellation_reason,
            s.cancelled_at,
            si.product_id,
            p.sku AS product_sku,
            p.name AS product_name,
            si.quantity,
            si.unit_of_measure,
            si.unit_price_cents,
            si.subtotal_cents,
            si.unit_cost_cents,
            si.estimated_gross_profit_cents AS item_profit_cents
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE strftime('%Y-%m', s.sale_date) = ?
        ORDER BY s.sale_date ASC, s.sale_number ASC, si.rowid ASC
    """
    result = await client.execute(sql, [period])
    return result_to_dicts(result)
