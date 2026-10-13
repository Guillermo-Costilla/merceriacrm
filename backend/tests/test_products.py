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
    email = f"prod_admin_{unique}@example.com"
    password = "SuperPassword123*"
    
    # Crear usuario de prueba
    user = await create_test_business(
        client=client_db,
        business_name=f"Comercio productos {unique}",
        email=email,
        password=password,
        full_name="Admin Productos"
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Iniciar sesión
        login_res = await client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_res.status_code == 200
        yield client

    # Limpieza
    await cleanup_test_business(client_db, user["business_id"])
    await client_db.close()

@pytest.mark.asyncio
async def test_create_and_get_product(auth_client):
    sku = f"BOTON-{str(uuid.uuid4())[:6].upper()}"
    payload = {
        "sku": sku,
        "name": "Botón Madera 20mm",
        "description": "Botón decorativo de 2 agujeros",
        "cost_cents": 15000,   # $150.00
        "price_cents": 35000,  # $350.00
        "current_stock": 50.0,
        "min_stock": 10.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    }

    # 1. Crear producto
    create_res = await auth_client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["sku"] == sku
    assert data["name"] == "Botón Madera 20mm"
    assert data["cost_cents"] == 15000
    assert data["price_cents"] == 35000
    assert data["current_stock"] == 50.0
    assert data["is_active"] is True
    product_id = data["id"]

    # 2. Consultar producto por ID
    get_res = await auth_client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == product_id

    # 3. Limpieza en BD
    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [product_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [product_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_duplicate_sku_rejected(auth_client):
    sku = f"CINTA-{str(uuid.uuid4())[:6].upper()}"
    payload = {
        "sku": sku,
        "name": "Cinta Raso 25mm",
        "cost_cents": 5000,
        "price_cents": 12000,
        "current_stock": 10.0,
        "min_stock": 2.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    }

    res1 = await auth_client.post("/api/products", json=payload)
    assert res1.status_code == 201
    prod_id = res1.json()["id"]

    # Intentar crear con el mismo SKU (incluso en minúsculas) debe dar 409
    payload_dup = {**payload, "sku": sku.lower(), "name": "Cinta Raso Duplicada"}
    res2 = await auth_client.post("/api/products", json=payload_dup)
    assert res2.status_code == 409

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [prod_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [prod_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_fractional_stock_validation(auth_client):
    # Probar que 'unidad' rechaza decimales (ej: 10.5 unidades)
    bad_payload = {
        "sku": f"AGUJA-{str(uuid.uuid4())[:6].upper()}",
        "name": "Agujas Crochet",
        "cost_cents": 50000,
        "price_cents": 120000,
        "current_stock": 10.5, # Invalido para unidad
        "min_stock": 2.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    }
    res = await auth_client.post("/api/products", json=bad_payload)
    assert res.status_code == 422

    # Probar que 'metro' sí acepta decimales (ej: 12.25 metros)
    good_payload = {
        "sku": f"ELAST-{str(uuid.uuid4())[:6].upper()}",
        "name": "Elástico Blanco 3cm",
        "cost_cents": 30000,
        "price_cents": 75000,
        "current_stock": 12.25,
        "min_stock": 5.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    }
    good_res = await auth_client.post("/api/products", json=good_payload)
    assert good_res.status_code == 201
    prod_id = good_res.json()["id"]
    assert good_res.json()["current_stock"] == 12.25

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [prod_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [prod_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_update_and_soft_delete_product(auth_client):
    sku = f"HILO-{str(uuid.uuid4())[:6].upper()}"
    payload = {
        "sku": sku,
        "name": "Hilo Coser Negro",
        "cost_cents": 8000,
        "price_cents": 18000,
        "current_stock": 20.0,
        "min_stock": 5.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    }

    create_res = await auth_client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    product_id = create_res.json()["id"]

    # 1. Modificar precio y nombre
    update_res = await auth_client.put(f"/api/products/{product_id}", json={
        "name": "Hilo Coser Negro 100m",
        "price_cents": 22000
    })
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Hilo Coser Negro 100m"
    assert update_res.json()["price_cents"] == 22000

    # 2. Desactivar producto (soft delete)
    del_res = await auth_client.delete(f"/api/products/{product_id}")
    assert del_res.status_code == 200
    assert del_res.json()["action"] == "deactivated"

    # 3. Comprobar que quedó inactivo
    get_res = await auth_client.get(f"/api/products/{product_id}")
    assert get_res.json()["is_active"] is False

    # 4. Reactivar producto
    patch_res = await auth_client.patch(f"/api/products/{product_id}/status", json={"is_active": True})
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is True

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id = ?", [product_id])
    await client_db.execute("DELETE FROM products WHERE id = ?", [product_id])
    await client_db.close()

@pytest.mark.asyncio
async def test_search_and_filters(auth_client):
    unique = str(uuid.uuid4())[:6].upper()
    sku1 = f"FILT1-{unique}"
    sku2 = f"FILT2-{unique}"

    # Producto 1 con stock normal
    p1 = await auth_client.post("/api/products", json={
        "sku": sku1,
        "name": f"Puntilla Algodón {unique}",
        "cost_cents": 1000,
        "price_cents": 2500,
        "current_stock": 15.0,
        "min_stock": 5.0,
        "unit_of_measure": "metro",
        "is_fractional": True
    })
    assert p1.status_code == 201
    id1 = p1.json()["id"]

    # Producto 2 con stock bajo (3 <= 5)
    p2 = await auth_client.post("/api/products", json={
        "sku": sku2,
        "name": f"Cierre Invisible {unique}",
        "cost_cents": 2000,
        "price_cents": 5000,
        "current_stock": 3.0,
        "min_stock": 5.0,
        "unit_of_measure": "unidad",
        "is_fractional": False
    })
    assert p2.status_code == 201
    id2 = p2.json()["id"]

    # 1. Búsqueda por texto (nombre o SKU)
    search_res = await auth_client.get(f"/api/products?search={unique}")
    assert search_res.status_code == 200
    items = search_res.json()["items"]
    assert len(items) >= 2

    # 2. Filtro por stock bajo
    low_res = await auth_client.get(f"/api/products?search={unique}&stock_status=low")
    assert low_res.status_code == 200
    low_items = low_res.json()["items"]
    assert any(p["sku"] == sku2 for p in low_items)
    assert not any(p["sku"] == sku1 for p in low_items)

    client_db = create_db_client()
    await client_db.execute("DELETE FROM inventory_movements WHERE product_id IN (?, ?)", [id1, id2])
    await client_db.execute("DELETE FROM products WHERE id IN (?, ?)", [id1, id2])
    await client_db.close()
