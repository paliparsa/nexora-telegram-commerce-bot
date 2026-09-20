PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL DEFAULT 'Provider #1',
  adapter TEXT NOT NULL DEFAULT 'reseller_v1',
  enabled INTEGER NOT NULL DEFAULT 1,
  default_markup_percent REAL NOT NULL DEFAULT 30,
  low_balance_usd REAL NOT NULL DEFAULT 10,
  auto_sync INTEGER NOT NULL DEFAULT 1,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 10,
  last_sync_at TEXT,
  last_balance_usd REAL,
  last_balance_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO providers(id,alias,adapter,enabled,default_markup_percent,low_balance_usd,auto_sync,sync_interval_minutes)
VALUES(1,'Provider #1','reseller_v1',1,30,10,1,10);

CREATE TABLE IF NOT EXISTS provider_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  upstream_product_id TEXT NOT NULL,
  upstream_name TEXT,
  upstream_description TEXT,
  source_price_usd REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  source_stock INTEGER NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 0,
  local_product_id INTEGER,
  pricing_mode TEXT NOT NULL DEFAULT 'provider' CHECK(pricing_mode IN ('provider','fixed','percent','fixed_profit')),
  fixed_price_credits REAL,
  markup_percent REAL,
  fixed_profit_credits REAL,
  last_sync_at TEXT,
  raw_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id,upstream_product_id),
  FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY(local_product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_products_local ON provider_products(local_product_id);
CREATE INDEX IF NOT EXISTS idx_provider_products_provider_stock ON provider_products(provider_id,in_stock,source_stock);

CREATE TABLE IF NOT EXISTS provider_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  local_order_id INTEGER NOT NULL UNIQUE,
  upstream_order_code TEXT UNIQUE,
  upstream_product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  source_total_usd REAL,
  status TEXT NOT NULL DEFAULT 'creating',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  FOREIGN KEY(local_order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_provider_orders_status ON provider_orders(status,updated_at);

CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider ON provider_sync_logs(provider_id,id DESC);

ALTER TABLE products ADD COLUMN source_type TEXT NOT NULL DEFAULT 'local';
ALTER TABLE products ADD COLUMN provider_product_id INTEGER REFERENCES provider_products(id);
ALTER TABLE products ADD COLUMN provider_price_locked INTEGER NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN source_type TEXT NOT NULL DEFAULT 'local';
ALTER TABLE orders ADD COLUMN provider_order_id INTEGER REFERENCES provider_orders(id);

INSERT OR IGNORE INTO bot_settings(key,value) VALUES
('provider_auto_sync','1'),
('provider_sync_minutes','10'),
('provider_low_balance_alert_cooldown','0'),
('feature_provider_products','1');
