import pytest
import uuid
from datetime import datetime
from httpx import ASGITransport, AsyncClient
from zoneinfo import ZoneInfo

from app.main import app
from app.core.database import create_db_client
from app.services.dashboard_service import get_business_day_utc_range
from tests.helpers import cleanup_test_business, create_test_business

def test_business_day_utc_range_uses_local_calendar_day():
    local_now = datetime(2026, 10, 12, 21, 18, tzinfo=ZoneInfo("America/Argentina/Tucuman"))

    assert get_business_day_utc_range(local_now) == (
        "2026-10-12 03:00:00",
        "2026-10-13 03:00:00"
    )

@pytest.fixture
async def auth_client():
    client_db = create_db_client()
    unique = str(uuid.uuid4())[:8]
    email = f"dash_admin_{unique}@example.com"
    password = "SuperPassword123*"

    user = await create_test_business(
        client=client_db,
        business_name=f"Comercio dashboard {unique}",
        email=email,
        password=password,
        full_name="Admin Dashboard"
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_res.status_code == 200
        yield client

    try:
        cleanup_db = create_db_client()
        await cleanup_test_business(cleanup_db, user["business_id"])
        await cleanup_db.close()
    except Exception:
        pass
    finally:
        try:
            await client_db.close()
        except Exception:
            pass

@pytest.mark.asyncio
async def test_get_dashboard_summary(auth_client):
    res = await auth_client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()

    assert "kpis" in data
    assert "daily_sales" in data
    assert "top_products" in data
    assert "period_label" in data

    kpis = data["kpis"]
    assert "today_sales_cents" in kpis
    assert "current_month_sales_cents" in kpis
    assert "current_month_gross_profit_cents" in kpis
    assert "low_stock_products_count" in kpis
    assert "out_of_stock_products_count" in kpis
    assert isinstance(data["daily_sales"], list)
    assert len(data["daily_sales"]) >= 28  # Al menos los días del mes

@pytest.mark.asyncio
async def test_dashboard_reflects_new_sale(auth_client):
    sku = f"DASH-{str(uuid.uuid4())[:6].upper()}"
    p_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Cinta Dorada Dashboard",
        "cost_cents": 3000,
        "price_cents": 8000,
        "current_stock": 20.0,
        "min_stock": 5.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    # Registrar venta de 5.0 m
    sale_res = await auth_client.post("/api/sales", json={
        "items": [{"product_id": p_id, "quantity": 5.0, "unit_price_cents": 8000}]
    })
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    sale_id = sale_data["id"]

    # Consultar dashboard
    dash_res = await auth_client.get("/api/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    assert dash_data["kpis"]["today_sales_cents"] >= 40000
    assert dash_data["kpis"]["current_month_gross_profit_cents"] >= 25000

    # Limpieza
    client_db = create_db_client()
    await client_db.execute("DELETE FROM sale_items WHERE sale_id = ?", [sale_id])
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [p_id])
    await client_db.execute("DELETE FROM sales WHERE id = ?", [sale_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [p_id])
    await client_db.close()
