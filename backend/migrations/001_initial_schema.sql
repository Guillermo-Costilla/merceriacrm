-- =====================================================================
-- MIGRACIÓN 001: Esquema Inicial para Mercería CRM
-- Base de datos: Turso (SQLite compatible)
-- Moneda: Centavos enteros (INTEGER)
-- Unidades fraccionales: REAL con precisión decimal
-- =====================================================================

-- 1. Tabla de Control de Migraciones
CREATE TABLE IF NOT EXISTS _schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. Configuración del Negocio
CREATE TABLE IF NOT EXISTS business_settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    business_name TEXT NOT NULL DEFAULT 'Mercería',
    report_title TEXT NOT NULL DEFAULT 'Reporte de Gestión y Ventas',
    currency_code TEXT NOT NULL DEFAULT 'ARS',
    currency_symbol TEXT NOT NULL DEFAULT '$',
    timezone TEXT NOT NULL DEFAULT 'America/Argentina/Tucuman',
    contact_email TEXT,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT OR IGNORE INTO business_settings (id, business_name, report_title, currency_code, currency_symbol, timezone, contact_email)
VALUES ('primary', 'Mercería', 'Reporte de Gestión y Ventas', 'ARS', '$', 'America/Argentina/Tucuman', NULL);

-- 3. Usuarios del Sistema (Monousuario inicial con soporte multiusuario futuro)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Sesiones Activas
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    user_agent TEXT,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 5. Tokens de Recuperación de Contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- 6. Categorías de Productos
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- 7. Catálogo de Productos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    current_stock REAL NOT NULL DEFAULT 0.0 CHECK (current_stock >= 0),
    min_stock REAL NOT NULL DEFAULT 0.0 CHECK (min_stock >= 0),
    unit_of_measure TEXT NOT NULL CHECK (unit_of_measure IN ('unidad', 'metro', 'paquete', 'rollo', 'centimetro', 'gramo')),
    is_fractional INTEGER NOT NULL DEFAULT 0 CHECK (is_fractional IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON products(is_active, current_stock, min_stock);

-- 8. Cabecera de Ventas
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    sale_number INTEGER UNIQUE NOT NULL,
    sale_date TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
    estimated_gross_profit_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    cancellation_reason TEXT,
    cancelled_at TEXT,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(sale_date, status);
CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);

-- 9. Detalles de Venta (Líneas de productos con costos históricos congelados)
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_of_measure TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    estimated_gross_profit_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- 10. Movimientos de Inventario (Auditoría inmutable de entradas, salidas y ajustes)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE_ENTRY', 'SALE_EXIT', 'SALE_REVERSION', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE')),
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    resulting_stock REAL NOT NULL CHECK (resulting_stock >= 0),
    reason TEXT NOT NULL,
    reference_sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_inv_product_date ON inventory_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_movement_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_reference_sale ON inventory_movements(reference_sale_id);
