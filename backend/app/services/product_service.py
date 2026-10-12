import uuid
from typing import Optional, Dict, Any, Tuple, List
import libsql_client

from app.schemas.product import ProductCreate, ProductUpdate, FRACTIONAL_DEFAULT_UNITS
from app.repositories import product_repo, category_repo

class ProductError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

async def create_product(
    client: libsql_client.Client,
    data: ProductCreate,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    # 1. Comprobar unicidad de SKU
    existing = await product_repo.get_product_by_sku(client, data.sku)
    if existing:
        raise ProductError(f"Ya existe un producto registrado con el código o SKU '{data.sku}'.", status_code=409)

    # 2. Verificar existencia de la categoría si se especificó
    if data.category_id:
        category = await category_repo.get_category_by_id(client, data.category_id)
        if not category:
            raise ProductError("La categoría seleccionada no existe.", status_code=404)

    # 3. Lógica de fraccionabilidad por defecto
    is_fractional = data.is_fractional
    if data.unit_of_measure in FRACTIONAL_DEFAULT_UNITS:
        is_fractional = True

    # 4. Validar que productos no fraccionables no tengan decimales
    if not is_fractional and (data.current_stock % 1 != 0 or data.min_stock % 1 != 0):
        raise ProductError(
            f"Los productos medidos en '{data.unit_of_measure}' solo admiten cantidades enteras.",
            status_code=422
        )

    product_id = str(uuid.uuid4())
    product_dict = {
        "id": product_id,
        "sku": data.sku,
        "name": data.name,
        "category_id": data.category_id,
        "description": data.description,
        "cost_cents": data.cost_cents,
        "price_cents": data.price_cents,
        "current_stock": data.current_stock,
        "min_stock": data.min_stock,
        "unit_of_measure": data.unit_of_measure,
        "is_fractional": 1 if is_fractional else 0,
        "is_active": 1,
    }

    # 5. Si tiene stock inicial > 0, registrar el movimiento de auditoría atómicamente
    if data.current_stock > 0:
        movement_id = str(uuid.uuid4())
        statements = [
            libsql_client.Statement(
                """
                INSERT INTO products (
                    id, sku, name, category_id, description, cost_cents, price_cents,
                    current_stock, min_stock, unit_of_measure, is_fractional, is_active
                ) VALUES (
                    :id, :sku, :name, :category_id, :description, :cost_cents, :price_cents,
                    :current_stock, :min_stock, :unit_of_measure, :is_fractional, :is_active
                )
                """,
                product_dict
            ),
            libsql_client.Statement(
                """
                INSERT INTO inventory_movements (
                    id, product_id, movement_type, quantity, previous_stock, resulting_stock,
                    reason, created_by_user_id
                ) VALUES (?, ?, 'PURCHASE_ENTRY', ?, 0.0, ?, ?, ?)
                """,
                [
                    movement_id,
                    product_id,
                    data.current_stock,
                    data.current_stock,
                    "Carga inicial de inventario al crear producto",
                    user_id
                ]
            )
        ]
        await client.batch(statements)
        created = await product_repo.get_product_by_id(client, product_id)
        return created # type: ignore
    else:
        created = await product_repo.create_product(client, product_dict)
        return created

async def update_product(
    client: libsql_client.Client,
    product_id: str,
    data: ProductUpdate
) -> Dict[str, Any]:
    current = await product_repo.get_product_by_id(client, product_id)
    if not current:
        raise ProductError("Producto no encontrado", status_code=404)

    # Si se actualiza el SKU, verificar que no colisione con otro producto
    if data.sku and data.sku != current["sku"]:
        existing = await product_repo.get_product_by_sku(client, data.sku)
        if existing and existing["id"] != product_id:
            raise ProductError(f"Ya existe otro producto con el código o SKU '{data.sku}'.", status_code=409)

    # Si se actualiza la categoría, verificar existencia
    if data.category_id and data.category_id != current["category_id"]:
        category = await category_repo.get_category_by_id(client, data.category_id)
        if not category:
            raise ProductError("La categoría seleccionada no existe.", status_code=404)

    # Preparar diccionario de campos modificados
    update_fields: Dict[str, Any] = {}
    data_dict = data.model_dump(exclude_unset=True)

    for key, val in data_dict.items():
        if key == "is_fractional":
            update_fields["is_fractional"] = 1 if val else 0
        else:
            update_fields[key] = val

    # Verificar unidad y fraccionabilidad resultante
    unit = update_fields.get("unit_of_measure", current["unit_of_measure"])
    is_frac = bool(update_fields.get("is_fractional", current["is_fractional"]))
    if unit in FRACTIONAL_DEFAULT_UNITS:
        is_frac = True
        update_fields["is_fractional"] = 1

    stock_val = update_fields.get("current_stock", current["current_stock"])
    if not is_frac and stock_val % 1 != 0:
        raise ProductError(
            f"El producto medido en '{unit}' no admite cantidades fraccionadas.",
            status_code=422
        )

    updated = await product_repo.update_product(client, product_id, update_fields)
    return updated

async def set_product_status(
    client: libsql_client.Client,
    product_id: str,
    is_active: bool
) -> Dict[str, Any]:
    current = await product_repo.get_product_by_id(client, product_id)
    if not current:
        raise ProductError("Producto no encontrado", status_code=404)

    await product_repo.set_product_active(client, product_id, is_active)
    updated = await product_repo.get_product_by_id(client, product_id)
    return updated # type: ignore

async def delete_or_deactivate_product(
    client: libsql_client.Client,
    product_id: str
) -> Dict[str, Any]:
    """
    Desactiva lógicamente el producto si posee movimientos/ventas.
    Si nunca tuvo operaciones, permite borrado físico.
    """
    current = await product_repo.get_product_by_id(client, product_id)
    if not current:
        raise ProductError("Producto no encontrado", status_code=404)

    has_history = await product_repo.check_product_has_movements(client, product_id)
    if has_history:
        # Desactivación lógica para preservar el historial
        await product_repo.set_product_active(client, product_id, False)
        return {
            "action": "deactivated",
            "message": f"El producto '{current['name']}' fue desactivado porque posee historial de ventas o inventario."
        }
    else:
        # Borrado físico seguro ya que no tiene dependencias
        await product_repo.delete_product_physical(client, product_id)
        return {
            "action": "deleted",
            "message": f"El producto '{current['name']}' fue eliminado exitosamente."
        }
