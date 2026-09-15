CREATE TABLE IF NOT EXISTS shop_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🛍',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO shop_categories(id,title,emoji,enabled,sort_order)
VALUES(1,'عمومی','🛍',1,10);

ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES shop_categories(id);
UPDATE products SET category_id=1 WHERE category_id IS NULL;

CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
  value REAL NOT NULL,
  min_total REAL NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_discount_enabled ON discount_codes(enabled,code);

ALTER TABLE orders ADD COLUMN discount_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN refund_amount REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_refund ON orders(status,refunded_at,id DESC);
