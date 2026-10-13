import pytest
import uuid
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.database import create_db_client
from tests.helpers import cleanup_test_business, create_test_business

@pytest.fixture
async def auth_client():
    client_db = create_db_client()
    unique = str(uuid.uuid4())[:8]
    email = f"sales_admin_{unique}@example.com"
    password = "SuperPassword123*"
    
    user = await create_test_business(
        client=client_db,
        business_name=f"Comercio ventas {unique}",
        email=email,
        password=password,
        full_name="Admin Ventas"
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
async def test_create_sale_success_and_stock_deduction(auth_client):
    sku1 = f"HILO-{str(uuid.uuid4())[:6].upper()}"
    sku2 = f"AGUJA-{str(uuid.uuid4())[:6].upper()}"

    # 1. Crear dos productos
    # Hilo: 10.0 metros, costo $50.00 ($5000 cents), precio $120.00 ($12000 cents)
    p1_res = await auth_client.post("/api/products", json={
        "sku": sku1,
        "name": "Hilo Seda",
        "cost_cents": 5000,
        "price_cents": 12000,
        "current_stock": 10.0,
        "min_stock": 2.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    assert p1_res.status_code == 201
    p1_id = p1_res.json()["id"]

    # Aguja: 20 unidades, costo $20.00 ($2000 cents), precio $60.00 ($6000 cents)
    p2_res = await auth_client.post("/api/products", json={
        "sku": sku2,
        "name": "Agujas Crochet",
        "cost_cents": 2000,
        "price_cents": 6000,
        "current_stock": 20.0,
        "min_stock": 5.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    })
    assert p2_res.status_code == 201
    p2_id = p2_res.json()["id"]

    # 2. Registrar venta: 2.5 metros de Hilo y 3 unidades de Aguja
    sale_payload = {
        "items": [
            {
                "product_id": p1_id,
                "quantity": 2.5,
                "unit_price_cents": 12000  # $120.00
            },
            {
                "product_id": p2_id,
                "quantity": 3.0,
                "unit_price_cents": 6000   # $60.00
            }
        ],
        "notes": "Venta de mostrador"
    }
    # Cálculos esperados:
    # Item 1: 2.5 * 12000 = 30000 cents ($300.00). Costo: 2.5 * 5000 = 12500 cents ($125.00). Ganancia: 17500 cents ($175.00)
    # Item 2: 3.0 * 6000 = 18000 cents ($180.00). Costo: 3.0 * 2000 = 6000 cents ($60.00). Ganancia: 12000 cents ($120.00)
    # Total: 48000 cents ($480.00). Costo Total: 18500 cents ($185.00). Ganancia Total: 29500 cents ($295.00)
    sale_res = await auth_client.post("/api/sales", json=sale_payload)
    assert sale_res.status_code == 201
    sale_data = sale_res.json()

    assert sale_data["status"] == "COMPLETED"
    assert sale_data["total_cents"] == 48000
    assert sale_data["total_cost_cents"] == 18500
    assert sale_data["estimated_gross_profit_cents"] == 29500
    assert len(sale_data["items"]) == 2

    # 3. Verificar deducción de stock
    p1_check = await auth_client.get(f"/api/products/{p1_id}")
    assert p1_check.json()["current_stock"] == 7.5

    p2_check = await auth_client.get(f"/api/products/{p2_id}")
    assert p2_check.json()["current_stock"] == 17.0

    # 4. Verificar que se listan en el historial
    list_res = await auth_client.get("/api/sales")
    assert list_res.status_code == 200
    sales_list = list_res.json()
    assert any(s["id"] == sale_data["id"] for s in sales_list["items"])

    # Limpieza
    client_db = create_db_client()
    await client_db.execute("DELETE FROM sale_items WHERE sale_id = ?", [sale_data["id"]])
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id IN (?, ?)", [p1_id, p2_id])
    await client_db.execute("DELETE FROM sales WHERE id = ?", [sale_data["id"]])
    await client_db.execute("DELETE FROM products WHERE id IN (?, ?)", [p1_id, p2_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_sale_insufficient_stock_rejected(auth_client):
    sku = f"BOTON-{str(uuid.uuid4())[:6].upper()}"
    p_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Botones Madera",
        "cost_cents": 1000,
        "price_cents": 2500,
        "current_stock": 5.0,
        "min_stock": 2.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    })
    p_id = p_res.json()["id"]

    # Intentar vender 10 unidades (hay solo 5)
    fail_res = await auth_client.post("/api/sales", json={
        "items": [
            {"product_id": p_id, "quantity": 10.0}
        ]
    })
    assert fail_res.status_code == 400
    assert "insuficiente" in fail_res.json()["detail"].lower()

    # Comprobar que el stock permanece en 5.0
    p_check = await auth_client.get(f"/api/products/{p_id}")
    assert p_check.json()["current_stock"] == 5.0

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [p_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [p_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_sale_idempotency_prevents_duplicate(auth_client):
    sku = f"IDEM-{str(uuid.uuid4())[:6].upper()}"
    p_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Producto Idempotencia",
        "cost_cents": 1000,
        "price_cents": 3000,
        "current_stock": 10.0,
        "min_stock": 1.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    })
    p_id = p_res.json()["id"]

    idempotency_key = f"key-{uuid.uuid4()}"
    sale_payload = {
        "items": [{"product_id": p_id, "quantity": 2.0}],
        "idempotency_key": idempotency_key
    }

    # Primera petición
    res1 = await auth_client.post("/api/sales", json=sale_payload)
    assert res1.status_code == 201
    sale_id = res1.json()["id"]

    # Segunda petición con la misma idempotency_key
    res2 = await auth_client.post("/api/sales", json=sale_payload)
    assert res2.status_code == 201 or res2.status_code == 200
    assert res2.json()["id"] == sale_id

    # El stock debe haber bajado solo 2 unidades (de 10.0 a 8.0, NO a 6.0)
    p_check = await auth_client.get(f"/api/products/{p_id}")
    assert p_check.json()["current_stock"] == 8.0

    client_db = create_db_client()
    await client_db.execute("DELETE FROM sale_items WHERE sale_id = ?", [sale_id])
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [p_id])
    await client_db.execute("DELETE FROM sales WHERE id = ?", [sale_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [p_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_sale_cancellation_restores_stock(auth_client):
    sku = f"ANULAR-{str(uuid.uuid4())[:6].upper()}"
    p_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Puntilla de Algodón",
        "cost_cents": 2000,
        "price_cents": 5000,
        "current_stock": 15.0,
        "min_stock": 2.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    p_id = p_res.json()["id"]

    # Registrar venta de 4.0 m
    sale_res = await auth_client.post("/api/sales", json={
        "items": [{"product_id": p_id, "quantity": 4.0}]
    })
    assert sale_res.status_code == 201
    sale_id = sale_res.json()["id"]

    # Stock actual debe ser 11.0 m
    p_after_sale = await auth_client.get(f"/api/products/{p_id}")
    assert p_after_sale.json()["current_stock"] == 11.0

    # Anular la venta
    reason = "Error de cobro registrado por el vendedor"
    cancel_res = await auth_client.post(f"/api/sales/{sale_id}/cancel", json={
        "cancellation_reason": reason
    })
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert cancel_data["status"] == "CANCELLED"
    assert cancel_data["cancellation_reason"] == reason

    # Comprobar que el stock volvió a 15.0 m
    p_restored = await auth_client.get(f"/api/products/{p_id}")
    assert p_restored.json()["current_stock"] == 15.0

    # Comprobar que intentar anular de nuevo falla
    retry_cancel = await auth_client.post(f"/api/sales/{sale_id}/cancel", json={
        "cancellation_reason": "Segundo intento"
    })
    assert retry_cancel.status_code == 400

    client_db = create_db_client()
    await client_db.execute("DELETE FROM sale_items WHERE sale_id = ?", [sale_id])
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [p_id])
    await client_db.execute("DELETE FROM sales WHERE id = ?", [sale_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [p_id])
    await client_db.close()
