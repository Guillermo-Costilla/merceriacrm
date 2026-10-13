import uuid
from typing import Dict, Any, List, Optional
import libsql_client

from app.schemas.sale import SaleCreate, SaleCancelRequest
from app.repositories import sale_repo, product_repo

class SaleError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

async def create_sale(
    client: libsql_client.Client,
    data: SaleCreate,
    business_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    # 1. Comprobar clave de idempotencia para prevenir dobles cobros
    if data.idempotency_key:
        existing = await sale_repo.get_sale_by_idempotency_key(client, business_id, data.idempotency_key)
        if existing:
            items = await sale_repo.get_sale_items(client, business_id, existing["id"])
            existing["items"] = items
            return existing

    if not data.items:
        raise SaleError("La venta debe contener al menos un producto.", status_code=422)

    # 2. Validar cada ítem, comprobar stock y congelar costos históricos
    prepared_items = []
    total_cents = 0
    total_cost_cents = 0

    # Agrupar cantidades por producto si se agregó el mismo producto varias veces
    product_requested_qtys: Dict[str, float] = {}
    for item in data.items:
        product_requested_qtys[item.product_id] = product_requested_qtys.get(item.product_id, 0.0) + item.quantity

    # Consultar productos y validar reglas
    products_map: Dict[str, Dict[str, Any]] = {}
    for pid, total_qty in product_requested_qtys.items():
        prod = await product_repo.get_product_by_id(client, business_id, pid)
        if not prod:
            raise SaleError(f"El producto con ID '{pid}' no existe.", status_code=404)
        if not prod.get("is_active"):
            raise SaleError(f"El producto '{prod['name']}' está inactivo y no puede venderse.", status_code=400)
        
        current_stock = float(prod["current_stock"])
        if current_stock < total_qty:
            raise SaleError(
                f"Stock insuficiente para '{prod['name']}'. Disponible: {current_stock} {prod['unit_of_measure']}, Solicitado: {total_qty} {prod['unit_of_measure']}.",
                status_code=400
            )
        products_map[pid] = prod

    # Calcular líneas de detalle
    sale_id = str(uuid.uuid4())
    batch_statements: List[libsql_client.Statement] = []

    for item in data.items:
        prod = products_map[item.product_id]
        qty = item.quantity

        if not prod.get("is_fractional") and qty % 1 != 0:
            raise SaleError(f"El producto '{prod['name']}' ({prod['unit_of_measure']}) solo admite cantidades enteras.", status_code=422)

        unit_price = item.unit_price_cents if item.unit_price_cents is not None else prod["price_cents"]
        unit_cost = prod["cost_cents"]  # Costo unitario histórico congelado

        line_subtotal = round(qty * unit_price)
        line_cost = round(qty * unit_cost)
        line_profit = line_subtotal - line_cost

        total_cents += line_subtotal
        total_cost_cents += line_cost

        item_id = str(uuid.uuid4())
        prepared_items.append({
            "id": item_id,
            "sale_id": sale_id,
            "product_id": prod["id"],
            "product_name": prod["name"],
            "product_sku": prod["sku"],
            "unit_of_measure": prod["unit_of_measure"],
            "quantity": qty,
            "unit_price_cents": unit_price,
            "unit_cost_cents": unit_cost,
            "subtotal_cents": line_subtotal,
            "estimated_gross_profit_cents": line_profit,
        })

    estimated_gross_profit_cents = total_cents - total_cost_cents
    next_number = await sale_repo.get_next_sale_number(client, business_id)

    # 3. Construir transacciones atómicas de inserción y descuento de inventario
    # Cabecera de venta
    batch_statements.append(
        libsql_client.Statement(
            """
            INSERT INTO sales (
                id, sale_number, total_cents, total_cost_cents, estimated_gross_profit_cents,
                status, notes, idempotency_key, created_by_user_id, business_id
            ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)
            """,
            [
                sale_id,
                next_number,
                total_cents,
                total_cost_cents,
                estimated_gross_profit_cents,
                data.notes,
                data.idempotency_key,
                user_id,
                business_id
            ]
        )
    )

    # Detalles de venta
    for it in prepared_items:
        batch_statements.append(
            libsql_client.Statement(
                """
                INSERT INTO sale_items (
                    id, sale_id, product_id, quantity, unit_of_measure,
                    unit_price_cents, unit_cost_cents, subtotal_cents, estimated_gross_profit_cents
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    it["id"],
                    it["sale_id"],
                    it["product_id"],
                    it["quantity"],
                    it["unit_of_measure"],
                    it["unit_price_cents"],
                    it["unit_cost_cents"],
                    it["subtotal_cents"],
                    it["estimated_gross_profit_cents"]
                ]
            )
        )

    # Actualización de stock y movimiento de auditoría por producto
    for pid, total_qty in product_requested_qtys.items():
        prod = products_map[pid]
        prev_stock = float(prod["current_stock"])
        new_stock = round(prev_stock - total_qty, 3)

        # UPDATE atómico con verificación de stock suficiente en la cláusula WHERE
        batch_statements.append(
            libsql_client.Statement(
                """
                UPDATE products 
                SET current_stock = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE business_id = ? AND id = ? AND current_stock >= ?
                """,
                [new_stock, business_id, pid, total_qty]
            )
        )

        # Registro inmutable en inventory_movements
        batch_statements.append(
            libsql_client.Statement(
                """
                INSERT INTO inventory_movements (
                    id, product_id, movement_type, quantity, previous_stock, resulting_stock,
                    reason, reference_sale_id, created_by_user_id, business_id
                ) VALUES (?, ?, 'SALE_EXIT', ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    str(uuid.uuid4()),
                    pid,
                    total_qty,
                    prev_stock,
                    new_stock,
                    f"Venta #{next_number}",
                    sale_id,
                    user_id,
                    business_id
                ]
            )
        )

    # 4. Ejecución atómica en Turso
    await client.batch(batch_statements)

    # 5. Retornar venta completa creada
    sale = await sale_repo.get_sale_by_id(client, business_id, sale_id)
    if not sale:
        raise SaleError("Error al recuperar la venta registrada", status_code=500)

    sale["items"] = prepared_items
    return sale

async def cancel_sale(
    client: libsql_client.Client,
    business_id: str,
    sale_id: str,
    reason: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    sale = await sale_repo.get_sale_by_id(client, business_id, sale_id)
    if not sale:
        raise SaleError("Venta no encontrada", status_code=404)

    if sale["status"] == "CANCELLED":
        raise SaleError("La venta ya se encuentra anulada previamente.", status_code=400)

    items = await sale_repo.get_sale_items(client, business_id, sale_id)
    batch_statements: List[libsql_client.Statement] = []

    # 1. Cambiar estado a CANCELLED
    batch_statements.append(
        libsql_client.Statement(
            """
            UPDATE sales 
            SET status = 'CANCELLED', cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP 
            WHERE business_id = ? AND id = ? AND status = 'COMPLETED'
            """,
            [reason.strip(), business_id, sale_id]
        )
    )

    # 2. Restaurar stock y generar movimientos SALE_REVERSION
    for it in items:
        pid = it["product_id"]
        qty = float(it["quantity"])
        prod = await product_repo.get_product_by_id(client, business_id, pid)
        prev_stock = float(prod["current_stock"]) if prod else 0.0
        new_stock = round(prev_stock + qty, 3)

        batch_statements.append(
            libsql_client.Statement(
                """
                UPDATE products 
                SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP 
                WHERE business_id = ? AND id = ?
                """,
                [qty, business_id, pid]
            )
        )

        batch_statements.append(
            libsql_client.Statement(
                """
                INSERT INTO inventory_movements (
                    id, product_id, movement_type, quantity, previous_stock, resulting_stock,
                    reason, reference_sale_id, created_by_user_id, business_id
                ) VALUES (?, ?, 'SALE_REVERSION', ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    str(uuid.uuid4()),
                    pid,
                    qty,
                    prev_stock,
                    new_stock,
                    f"Anulación Venta #{sale['sale_number']}: {reason.strip()}",
                    sale_id,
                    user_id,
                    business_id
                ]
            )
        )

    # 3. Ejecución atómica de reversión en Turso
    await client.batch(batch_statements)

    cancelled_sale = await sale_repo.get_sale_by_id(client, business_id, sale_id)
    if not cancelled_sale:
        raise SaleError("Error al recuperar la venta anulada", status_code=500)

    cancelled_sale["items"] = items
    return cancelled_sale
