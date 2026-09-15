PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  inviter_telegram_id INTEGER,
  join_verified INTEGER NOT NULL DEFAULT 0,
  state TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  kind TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(telegram_id, id DESC);

CREATE TABLE IF NOT EXISTS required_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  join_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_telegram_id INTEGER NOT NULL,
  invitee_telegram_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  reward REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rewarded_at TEXT
);

CREATE TABLE IF NOT EXISTS credit_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  pay_usd REAL NOT NULL,
  credits REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS payment_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  telegram_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  network TEXT,
  asset TEXT,
  requested_usd REAL NOT NULL,
  credit_amount REAL NOT NULL,
  expected_amount REAL,
  destination TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  receipt_file_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_pending ON payment_invoices(status, method, expires_at);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  price_credits REAL NOT NULL,
  delivery_type TEXT NOT NULL DEFAULT 'stock',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  secret_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_available ON product_stock(product_id, status, id);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  telegram_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  telegram_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  order_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  last_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO credit_packages(title,pay_usd,credits,sort_order) VALUES
('1 اعتبار — $1',1,1,10),
('15 اعتبار + 1 هدیه — $15',15,16,20),
('50 اعتبار + 4 هدیه — $50',50,54,30),
('100 اعتبار + 10 هدیه — $100',100,110,40);

INSERT OR IGNORE INTO products(id,title,description,price_credits,delivery_type,enabled,sort_order) VALUES
(1,'نمونه محصول دیجیتال','این محصول نمونه است؛ از دیتابیس و پنل ادمین جایگزینش کن.',1.5,'stock',0,10);
