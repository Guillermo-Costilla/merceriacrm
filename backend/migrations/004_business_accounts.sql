-- Follow the already-applied 001-003 migrations without reusing their version numbers.
-- Preserve the legacy bookkeeping columns and assign all existing rows to one tenant.
CREATE TABLE businesses (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO businesses (id, business_name)
VALUES ('legacy-business', 'Trazos Librería');

ALTER TABLE users ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE users SET business_id = 'legacy-business' WHERE business_id IS NULL;

UPDATE business_settings
SET id = 'legacy-business'
WHERE id = 'primary';

UPDATE businesses
SET business_name = (
    SELECT business_name FROM business_settings WHERE id = 'legacy-business'
)
WHERE id = 'legacy-business';

ALTER TABLE purchases ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE purchases SET business_id = 'legacy-business' WHERE business_id IS NULL;

ALTER TABLE expenses ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE expenses SET business_id = 'legacy-business' WHERE business_id IS NULL;

ALTER TABLE owner_contributions ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE owner_contributions SET business_id = 'legacy-business' WHERE business_id IS NULL;

ALTER TABLE operators ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE operators SET business_id = 'legacy-business' WHERE business_id IS NULL;

ALTER TABLE product_change_log ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE product_change_log SET business_id = 'legacy-business' WHERE business_id IS NULL;

ALTER TABLE registration_invites ADD COLUMN business_id TEXT REFERENCES businesses(id);
UPDATE registration_invites SET business_id = 'legacy-business' WHERE business_id IS NULL;

CREATE TABLE categories_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (business_id, name)
);

CREATE TABLE products_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sku TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories_new(id) ON DELETE SET NULL,
    description TEXT,
    cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    current_stock REAL NOT NULL DEFAULT 0.0 CHECK (current_stock >= 0),
    min_stock REAL NOT NULL DEFAULT 0.0 CHECK (min_stock >= 0),
    unit_of_measure TEXT NOT NULL CHECK (unit_of_measure IN ('unidad', 'metro', 'paquete', 'rollo', 'centimetro', 'gramo')),
    is_fractional INTEGER NOT NULL DEFAULT 0 CHECK (is_fractional IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (business_id, sku)
);

CREATE TABLE sales_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_number INTEGER NOT NULL,
    sale_date TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
    estimated_gross_profit_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    cancellation_reason TEXT,
    cancelled_at TEXT,
    notes TEXT,
    idempotency_key TEXT,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    operator_id TEXT,
    operator_name TEXT,
    cancelled_by_operator_id TEXT,
    cancelled_by_operator_name TEXT,
    UNIQUE (business_id, sale_number),
    UNIQUE (business_id, idempotency_key)
);

CREATE TABLE sale_items_new (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales_new(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products_new(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_of_measure TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    estimated_gross_profit_cents INTEGER NOT NULL
);

CREATE TABLE inventory_movements_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products_new(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE_ENTRY', 'SALE_EXIT', 'SALE_REVERSION', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE')),
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    resulting_stock REAL NOT NULL CHECK (resulting_stock >= 0),
    reason TEXT NOT NULL,
    reference_sale_id TEXT REFERENCES sales_new(id) ON DELETE SET NULL,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    operator_id TEXT,
    operator_name TEXT,
    reference_purchase_id TEXT
);

CREATE TABLE purchase_items_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products_new(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    previous_stock REAL NOT NULL CHECK (previous_stock >= 0),
    previous_cost_cents INTEGER NOT NULL CHECK (previous_cost_cents >= 0)
);

INSERT INTO categories_new (id, business_id, name, description, is_active, created_at)
SELECT id, 'legacy-business', name, description, is_active, created_at FROM categories;

INSERT INTO products_new (
    id, business_id, sku, name, category_id, description, cost_cents, price_cents,
    current_stock, min_stock, unit_of_measure, is_fractional, is_active, created_at, updated_at
)
SELECT
    id, 'legacy-business', sku, name, category_id, description, cost_cents, price_cents,
    current_stock, min_stock, unit_of_measure, is_fractional, is_active, created_at, updated_at
FROM products;

INSERT INTO sales_new (
    id, business_id, sale_number, sale_date, total_cents, total_cost_cents,
    estimated_gross_profit_cents, status, cancellation_reason, cancelled_at, notes,
    idempotency_key, created_by_user_id, created_at, operator_id, operator_name,
    cancelled_by_operator_id, cancelled_by_operator_name
)
SELECT
    id, 'legacy-business', sale_number, sale_date, total_cents, total_cost_cents,
    estimated_gross_profit_cents, status, cancellation_reason, cancelled_at, notes,
    idempotency_key, created_by_user_id, created_at, operator_id, operator_name,
    cancelled_by_operator_id, cancelled_by_operator_name
FROM sales;

INSERT INTO sale_items_new (
    id, sale_id, product_id, quantity, unit_of_measure, unit_price_cents,
    unit_cost_cents, subtotal_cents, estimated_gross_profit_cents
)
SELECT id, sale_id, product_id, quantity, unit_of_measure, unit_price_cents,
       unit_cost_cents, subtotal_cents, estimated_gross_profit_cents
FROM sale_items;

INSERT INTO inventory_movements_new (
    id, business_id, product_id, movement_type, quantity, previous_stock,
    resulting_stock, reason, reference_sale_id, created_by_user_id, created_at,
    operator_id, operator_name, reference_purchase_id
)
SELECT
    id, 'legacy-business', product_id, movement_type, quantity, previous_stock,
    resulting_stock, reason, reference_sale_id, created_by_user_id, created_at,
    operator_id, operator_name, reference_purchase_id
FROM inventory_movements;

INSERT INTO purchase_items_new (
    id, business_id, purchase_id, product_id, quantity, unit_cost_cents, subtotal_cents,
    previous_stock, previous_cost_cents
)
SELECT
    id, 'legacy-business', purchase_id, product_id, quantity, unit_cost_cents,
    subtotal_cents, previous_stock, previous_cost_cents
FROM purchase_items;

DROP TABLE inventory_movements;
DROP TABLE sale_items;
DROP TABLE purchase_items;
DROP TABLE sales;
DROP TABLE products;
DROP TABLE categories;

ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE products_new RENAME TO products;
ALTER TABLE sales_new RENAME TO sales;
ALTER TABLE sale_items_new RENAME TO sale_items;
ALTER TABLE inventory_movements_new RENAME TO inventory_movements;
ALTER TABLE purchase_items_new RENAME TO purchase_items;

CREATE INDEX idx_categories_business_name ON categories(business_id, name);
CREATE INDEX idx_products_business_sku ON products(business_id, sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active_stock ON products(business_id, is_active, current_stock, min_stock);
CREATE INDEX idx_sales_business_date_status ON sales(business_id, sale_date, status);
CREATE INDEX idx_sales_number ON sales(business_id, sale_number);
CREATE INDEX idx_sales_idempotency ON sales(business_id, idempotency_key);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_inv_product_date ON inventory_movements(business_id, product_id, created_at);
CREATE INDEX idx_inv_movement_type ON inventory_movements(business_id, movement_type);
CREATE INDEX idx_inv_reference_sale ON inventory_movements(reference_sale_id);
CREATE INDEX idx_purchase_items_business_purchase ON purchase_items(business_id, purchase_id);
CREATE INDEX idx_purchases_business_date ON purchases(business_id, purchased_at);
CREATE INDEX idx_expenses_business_date_status ON expenses(business_id, occurred_at, status);
CREATE INDEX idx_owner_contributions_business_date ON owner_contributions(business_id, contributed_at);
CREATE INDEX idx_operators_business_name ON operators(business_id, full_name);
CREATE INDEX idx_product_change_log_business_product_date
    ON product_change_log(business_id, product_id, created_at);
