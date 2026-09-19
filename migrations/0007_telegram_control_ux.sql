PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS delivery_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emoji TEXT NOT NULL DEFAULT '📦',
  mode TEXT NOT NULL DEFAULT 'stock' CHECK(mode IN ('stock','manual','info')),
  template_text TEXT,
  eta_text TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO delivery_types(id,title,emoji,mode,template_text,eta_text,enabled,sort_order) VALUES
(1,'تحویل خودکار از استوک','⚡','stock','{stock_value}','آنی',1,10),
(2,'تحویل دستی','👨‍💻','manual','پس از ثبت سفارش، تحویل توسط پشتیبانی انجام می‌شود.','طبق توضیحات محصول',1,20),
(3,'اطلاعات / راهنما','📋','info','{stock_value}','آنی',1,30);

ALTER TABLE products ADD COLUMN delivery_type_id INTEGER REFERENCES delivery_types(id);
ALTER TABLE products ADD COLUMN min_qty INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN max_qty INTEGER NOT NULL DEFAULT 10;
ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER;

UPDATE products SET delivery_type_id=CASE WHEN lower(COALESCE(delivery_type,'stock'))='stock' THEN 1 ELSE 2 END WHERE delivery_type_id IS NULL;

CREATE TABLE IF NOT EXISTS user_favorites (
  telegram_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id,product_id),
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS restock_watch (
  telegram_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TEXT,
  PRIMARY KEY(telegram_id,product_id),
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_restock_watch_product ON restock_watch(product_id,active);

CREATE TABLE IF NOT EXISTS broadcast_drafts (
  admin_telegram_id INTEGER PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text',
  file_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE broadcasts ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE broadcasts ADD COLUMN file_id TEXT;

INSERT OR IGNORE INTO bot_settings(key,value) VALUES
('scanner_last_run',''),
('faq_text','❓ سوالات متداول\n\n• پرداخت‌های کریپتو پس از تأیید شبکه خودکار بررسی می‌شوند.\n• کارت‌به‌کارت به‌صورت دستی توسط ادمین تأیید می‌شود.\n• برای مشکل هر سفارش، از همان سفارش وارد پشتیبانی شوید.'),
('show_stock_to_users','1'),
('feature_favorites','1'),
('feature_restock_watch','1');

CREATE TABLE IF NOT EXISTS order_manual_deliveries (
  order_id INTEGER PRIMARY KEY,
  delivery_text TEXT NOT NULL,
  delivered_by INTEGER,
  delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);
