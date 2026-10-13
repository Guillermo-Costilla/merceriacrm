import uuid
from typing import Dict, Any, List, Optional
import libsql_client

from app.schemas.inventory import (
    InventoryMovementCreate,
    InventoryReconciliationItem,
    InventoryReconciliationReport
)
from app.repositories import inventory_repo, product_repo

class InventoryError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

async def record_manual_movement(
    client: libsql_client.Client,
    data: InventoryMovementCreate,
    business_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    # 1. Comprobar existencia del producto
    product = await product_repo.get_product_by_id(client, business_id, data.product_id)
    if not product:
        raise InventoryError("Producto no encontrado", status_code=404)

    if not product.get("is_active"):
        raise InventoryError("No se pueden registrar movimientos en un producto inactivo.", status_code=400)

    # 2. Validar compatibilidad de cantidades con unidad no fraccionable
    if not product.get("is_fractional") and data.quantity % 1 != 0:
        raise InventoryError(
            f"El producto '{product['name']}' ({product['unit_of_measure']}) solo permite cantidades enteras.",
            status_code=422
        )

    previous_stock = float(product["current_stock"])
    qty = float(data.quantity)

    # 3. Calcular saldo resultante según el tipo de movimiento
    if data.movement_type in ("PURCHASE_ENTRY", "ADJUSTMENT_POSITIVE"):
        resulting_stock = round(previous_stock + qty, 3)
    elif data.movement_type == "ADJUSTMENT_NEGATIVE":
        resulting_stock = round(previous_stock - qty, 3)
        if resulting_stock < 0:
            raise InventoryError(
                f"El ajuste negativo superaría el stock disponible. Stock actual: {previous_stock}, Reducción solicitada: {qty}.",
                status_code=400
            )
    else:
        raise InventoryError(f"Tipo de movimiento '{data.movement_type}' no admitido para registro manual.", status_code=400)

    # 4. Transacción atómica en Turso con lote batch
    movement_id = str(uuid.uuid4())
    statements = [
        libsql_client.Statement(
            """
            UPDATE products 
            SET current_stock = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE business_id = ? AND id = ? AND current_stock = ?
            """,
            [resulting_stock, business_id, data.product_id, previous_stock]
        ),
        libsql_client.Statement(
            """
            INSERT INTO inventory_movements (
                id, product_id, movement_type, quantity, previous_stock, resulting_stock,
                reason, created_by_user_id, business_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                movement_id,
                data.product_id,
                data.movement_type,
                qty,
                previous_stock,
                resulting_stock,
                data.reason,
                user_id,
                business_id
            ]
        )
    ]

    await client.batch(statements)

    # 5. Obtener el registro enriquecido
    movement = await inventory_repo.get_movement_by_id(client, business_id, movement_id)
    if not movement:
        raise InventoryError("Error al recuperar el movimiento registrado", status_code=500)

    return movement

async def get_reconciliation_report(
    client: libsql_client.Client,
    business_id: str
) -> InventoryReconciliationReport:
    """
    Compara el stock actual con la reconstrucción histórica de cada producto.
    """
    rows = await inventory_repo.get_reconciliation_audit(client, business_id)
    items: List[InventoryReconciliationItem] = []
    consistent_count = 0
    discrepancy_count = 0

    for row in rows:
        curr = float(row["current_stock"])
        calc = round(float(row["calculated_stock"]), 3)
        diff = round(abs(curr - calc), 3)
        is_consistent = (diff < 0.001)

        if is_consistent:
            consistent_count += 1
        else:
            discrepancy_count += 1

        items.append(
            InventoryReconciliationItem(
                product_id=row["product_id"],
                product_name=row["product_name"],
                sku=row["sku"],
                unit_of_measure=row["unit_of_measure"],
                current_stock=curr,
                calculated_stock=calc,
                is_consistent=is_consistent,
                difference=diff
            )
        )

    return InventoryReconciliationReport(
        total_products_checked=len(items),
        consistent_count=consistent_count,
        discrepancy_count=discrepancy_count,
        is_fully_consistent=(discrepancy_count == 0),
        items=items
    )
