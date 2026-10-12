import pytest
import uuid
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.database import create_db_client
from app.services import auth_service

@pytest.fixture
async def auth_client():
    client_db = create_db_client()
    unique = str(uuid.uuid4())[:8]
    email = f"inv_admin_{unique}@example.com"
    password = "SuperPassword123*"
    
    user = await auth_service.create_initial_admin(
        client=client_db,
        email=email,
        password=password,
        full_name="Admin Inventario"
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_res.status_code == 200
        yield client

    await client_db.execute("DELETE FROM users WHERE id = ?", [user["id"]])
    await client_db.close()

@pytest.mark.asyncio
async def test_purchase_entry_movement(auth_client):
    sku = f"CINTA-{str(uuid.uuid4())[:6].upper()}"
    
    # 1. Crear producto con stock inicial 10.0 metros
    prod_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Cinta Organza",
        "cost_cents": 5000,
        "price_cents": 12000,
        "current_stock": 10.0,
        "min_stock": 5.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. Registrar entrada de mercadería de 15.5 metros
    entry_res = await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "PURCHASE_ENTRY",
        "quantity": 15.5,
        "reason": "Ingreso de factura de proveedor #1042"
    })
    assert entry_res.status_code == 201
    entry_data = entry_res.json()
    assert entry_data["previous_stock"] == 10.0
    assert entry_data["resulting_stock"] == 25.5
    assert entry_data["quantity"] == 15.5
    assert entry_data["movement_type"] == "PURCHASE_ENTRY"

    # 3. Verificar que el producto refleje el nuevo stock (25.5)
    prod_get = await auth_client.get(f"/api/products/{prod_id}")
    assert prod_get.json()["current_stock"] == 25.5

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [prod_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [prod_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_adjustment_movements_and_negative_stock_rejection(auth_client):
    sku = f"BOTON-{str(uuid.uuid4())[:6].upper()}"
    
    # 1. Crear producto con stock inicial 20 unidades
    prod_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Botones Nácar",
        "cost_cents": 2000,
        "price_cents": 4500,
        "current_stock": 20.0,
        "min_stock": 5.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. Ajuste positivo de 5 unidades -> stock debe quedar en 25
    pos_res = await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "ADJUSTMENT_POSITIVE",
        "quantity": 5.0,
        "reason": "Recuento físico: se encontraron 5 unidades adicionales"
    })
    assert pos_res.status_code == 201
    assert pos_res.json()["previous_stock"] == 20.0
    assert pos_res.json()["resulting_stock"] == 25.0

    # 3. Ajuste negativo válido de 10 unidades -> stock debe quedar en 15
    neg_res = await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "ADJUSTMENT_NEGATIVE",
        "quantity": 10.0,
        "reason": "Botones rotos o defectuosos descartados"
    })
    assert neg_res.status_code == 201
    assert neg_res.json()["previous_stock"] == 25.0
    assert neg_res.json()["resulting_stock"] == 15.0

    # 4. Ajuste negativo excesivo de 20 unidades (solo hay 15) -> DEBE RECHAZARSE (400)
    fail_res = await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "ADJUSTMENT_NEGATIVE",
        "quantity": 20.0,
        "reason": "Intento inválido de retirar más del stock disponible"
    })
    assert fail_res.status_code == 400
    assert "superaría el stock disponible" in fail_res.json()["detail"].lower()

    # 5. Comprobar que el stock del producto sigue intacto en 15.0
    prod_get = await auth_client.get(f"/api/products/{prod_id}")
    assert prod_get.json()["current_stock"] == 15.0

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [prod_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [prod_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_inventory_reconciliation_audit(auth_client):
    sku = f"RECON-{str(uuid.uuid4())[:6].upper()}"
    
    # Crear producto con 5.0 m iniciales
    prod_res = await auth_client.post("/api/products", json={
        "sku": sku,
        "name": "Cinta Bies Reconciliacion",
        "cost_cents": 1000,
        "price_cents": 2500,
        "current_stock": 5.0,
        "min_stock": 2.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Entrada de 10.0 m
    await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "PURCHASE_ENTRY",
        "quantity": 10.0,
        "reason": "Entrada compra"
    })

    # Ajuste negativo de 2.5 m
    await auth_client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "movement_type": "ADJUSTMENT_NEGATIVE",
        "quantity": 2.5,
        "reason": "Ajuste mermas"
    })

    # Stock esperado: 5.0 + 10.0 - 2.5 = 12.5 m

    # Ejecutar reporte de reconciliación
    recon_res = await auth_client.get("/api/inventory/reconciliation")
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    assert recon_data["is_fully_consistent"] is True

    # Buscar nuestro producto en los resultados
    matching = [p for p in recon_data["items"] if p["product_id"] == prod_id]
    assert len(matching) == 1
    prod_audit = matching[0]
    assert prod_audit["current_stock"] == 12.5
    assert prod_audit["calculated_stock"] == 12.5
    assert prod_audit["is_consistent"] is True
    assert prod_audit["difference"] == 0.0

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [prod_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [prod_id])
    await client_db.close()
