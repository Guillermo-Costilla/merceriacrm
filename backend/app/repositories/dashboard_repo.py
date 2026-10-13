import libsql_client
from typing import Dict, Any, List, Optional, Tuple
from app.core.database import result_to_dicts

async def get_sales_period_summary(
    client: libsql_client.Client,
    business_id: str,
    period_str: str,
    max_day: Optional[int] = None
) -> Dict[str, Any]:
    """
    period_str: 'YYYY-MM'
    max_day: opcional para cálculo Month-To-Date (MTD)
    """
    where_sql = "s.business_id = ? AND s.status = 'COMPLETED' AND strftime('%Y-%m', s.sale_date) = ?"
    params: List[Any] = [business_id, period_str]

    if max_day is not None:
        where_sql += " AND CAST(strftime('%d', s.sale_date) AS INTEGER) <= ?"
        params.append(max_day)

    sql = f"""
        SELECT
            COALESCE(SUM(s.total_cents), 0) as total_sales_cents,
            COALESCE(SUM(s.estimated_gross_profit_cents), 0) as total_profit_cents,
            COUNT(s.id) as operations_count
        FROM sales s
        WHERE {where_sql}
    """
    rs = await client.execute(sql, params)
    rows = result_to_dicts(rs)
    if rows:
        return {
            "total_sales_cents": int(rows[0]["total_sales_cents"]),
            "total_profit_cents": int(rows[0]["total_profit_cents"]),
            "operations_count": int(rows[0]["operations_count"])
        }
    return {"total_sales_cents": 0, "total_profit_cents": 0, "operations_count": 0}

async def get_period_units_sold(
    client: libsql_client.Client,
    business_id: str,
    period_str: str
) -> float:
    sql = """
        SELECT COALESCE(SUM(si.quantity), 0) as total_units
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.business_id = ? AND s.status = 'COMPLETED' AND strftime('%Y-%m', s.sale_date) = ?
    """
    rs = await client.execute(sql, [business_id, period_str])
    return float(rs.rows[0][0]) if rs.rows and rs.rows[0][0] is not None else 0.0

async def get_today_sales(
    client: libsql_client.Client,
    business_id: str,
    day_start_utc: str,
    next_day_start_utc: str
) -> Dict[str, Any]:
    sql = """
        SELECT
            COALESCE(SUM(total_cents), 0) as total_cents,
            COUNT(*) as operations_count
        FROM sales
        WHERE business_id = ? AND status = 'COMPLETED' AND sale_date >= ? AND sale_date < ?
    """
    rs = await client.execute(sql, [business_id, day_start_utc, next_day_start_utc])
    rows = result_to_dicts(rs)
    if rows:
        return {
            "total_cents": int(rows[0]["total_cents"]),
            "operations_count": int(rows[0]["operations_count"])
        }
    return {"total_cents": 0, "operations_count": 0}

async def get_inventory_kpis(
    client: libsql_client.Client,
    business_id: str
) -> Dict[str, int]:
    sql = """
        SELECT
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as total_active,
            COUNT(CASE WHEN is_active = 1 AND current_stock <= min_stock AND current_stock > 0 THEN 1 END) as low_stock,
            COUNT(CASE WHEN is_active = 1 AND current_stock <= 0 THEN 1 END) as out_of_stock
        FROM products
        WHERE business_id = ?
    """
    rs = await client.execute(sql, [business_id])
    rows = result_to_dicts(rs)
    if rows:
        return {
            "total_active": int(rows[0]["total_active"]),
            "low_stock": int(rows[0]["low_stock"]),
            "out_of_stock": int(rows[0]["out_of_stock"])
        }
    return {"total_active": 0, "low_stock": 0, "out_of_stock": 0}

async def get_daily_sales_series(
    client: libsql_client.Client,
    business_id: str,
    period_str: str
) -> List[Dict[str, Any]]:
    sql = """
        SELECT
            CAST(strftime('%d', sale_date) AS INTEGER) as day,
            date(sale_date) as date,
            SUM(total_cents) as sales_cents,
            SUM(estimated_gross_profit_cents) as profit_cents,
            COUNT(*) as operations_count
        FROM sales
        WHERE business_id = ? AND status = 'COMPLETED' AND strftime('%Y-%m', sale_date) = ?
        GROUP BY day
        ORDER BY day ASC
    """
    rs = await client.execute(sql, [business_id, period_str])
    return result_to_dicts(rs)

async def get_top_products_period(
    client: libsql_client.Client,
    business_id: str,
    period_str: str,
    limit: int = 3
) -> List[Dict[str, Any]]:
    sql = """
        SELECT
            si.product_id,
            p.sku,
            p.name,
            si.unit_of_measure,
            ROUND(SUM(si.quantity), 3) as units_sold,
            SUM(si.subtotal_cents) as revenue_cents,
            SUM(si.estimated_gross_profit_cents) as profit_cents
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.business_id = ? AND s.status = 'COMPLETED' AND strftime('%Y-%m', s.sale_date) = ?
        GROUP BY si.product_id
        ORDER BY units_sold DESC
        LIMIT ?
    """
    rs = await client.execute(sql, [business_id, period_str, limit])
    return result_to_dicts(rs)
