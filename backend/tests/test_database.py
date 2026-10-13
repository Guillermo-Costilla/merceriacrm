import pytest
import uuid
from app.core.database import create_db_client, check_database_health, result_to_dicts

@pytest.mark.asyncio
async def test_turso_connection_and_latency():
    health = await check_database_health()
    assert health["connected"] is True
    assert health["error"] is None
    assert isinstance(health["latency_ms"], float)
    assert health["latency_ms"] > 0

@pytest.mark.asyncio
async def test_all_required_tables_exist():
    client = create_db_client()
    try:
        rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        table_names = {row[0] for row in rs.rows}
        
        expected_tables = {
            "_schema_migrations",
            "businesses",
            "business_settings",
            "users",
            "sessions",
            "password_reset_tokens",
            "categories",
            "products",
            "sales",
            "sale_items",
            "inventory_movements",
        }
        
        missing_tables = expected_tables - table_names
        assert not missing_tables, f"Faltan tablas en Turso: {missing_tables}"
    finally:
        await client.close()

@pytest.mark.asyncio
async def test_business_settings_default_row():
    client = create_db_client()
    try:
        rs = await client.execute("SELECT * FROM business_settings ORDER BY id LIMIT 1")
        rows = result_to_dicts(rs)
        assert len(rows) == 1
        setting = rows[0]
        assert setting["currency_code"] == "ARS"
        assert setting["currency_symbol"] == "$"
        assert setting["timezone"] == "America/Argentina/Tucuman"
    finally:
        await client.close()

@pytest.mark.asyncio
async def test_negative_stock_check_constraint_enforced():
    client = create_db_client()
    business_id = f"test-negative-{uuid.uuid4()}"
    try:
        await client.execute(
            "INSERT INTO businesses (id, business_name) VALUES (?, ?)",
            [business_id, "Test Negative Stock"]
        )
        # Intentar insertar un producto con stock negativo (-5) debe fallar por el CHECK constraint
        with pytest.raises(Exception):
            await client.execute("""
                INSERT INTO products (
                    id, business_id, sku, name, cost_cents, price_cents, current_stock, min_stock,
                    unit_of_measure, is_fractional, is_active
                ) VALUES (
                    'test-neg-id', ?, 'SKU-FAIL', 'Producto Invalido', 100, 200, -5.0, 0.0,
                    'unidad', 0, 1
                )
            """, [business_id])
    finally:
        await client.execute("DELETE FROM businesses WHERE id = ?", [business_id])
        await client.close()
