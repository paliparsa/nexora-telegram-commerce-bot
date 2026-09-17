PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE users ADD COLUMN risk_note TEXT;
ALTER TABLE users ADD COLUMN purchase_limit REAL;
ALTER TABLE users ADD COLUMN referral_disabled INTEGER NOT NULL DEFAULT 0;


CREATE TABLE IF NOT EXISTS risk_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('wallet','txid','username')),
  value TEXT NOT NULL COLLATE NOCASE,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kind,value)
);
CREATE INDEX IF NOT EXISTS idx_risk_blacklist_kind ON risk_blacklist(kind,value);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  public_id TEXT NOT NULL,
  telegram_id INTEGER,
  event_type TEXT NOT NULL,
  network TEXT,
  tx_hash TEXT,
  expected_amount REAL,
  detected_amount REAL,
  confirmations INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(public_id,event_type,tx_hash),
  FOREIGN KEY(invoice_id) REFERENCES payment_invoices(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_recent ON payment_events(id DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_invoice ON payment_events(invoice_id,id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_issue_tx ON payment_events(tx_hash) WHERE tx_hash IS NOT NULL AND tx_hash<>'' AND event_type IN ('late_payment','underpayment','overpayment');

CREATE TABLE IF NOT EXISTS rate_quotes (
  pair TEXT PRIMARY KEY,
  rate REAL NOT NULL,
  source TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  ref_id TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_notification_log_recent ON admin_notification_log(id DESC);

INSERT OR IGNORE INTO bot_settings(key,value) VALUES
('maintenance_mode','0'),
('feature_shop','1'),
('feature_crypto','1'),
('feature_card','1'),
('feature_referral','1'),
('feature_support','1'),
('feature_broadcast','1'),
('notify_new_orders','1'),
('notify_crypto_payments','1'),
('notify_low_stock','1'),
('notify_payment_issues','1'),
('low_stock_threshold','5'),
('payment_near_match_percent','2'),
('payment_late_grace_minutes','1440'),
('confirmations_bep20','3'),
('confirmations_trc20','1'),
('confirmations_ton','1'),
('referral_reward_trigger','join'),
('referral_reward_amount','0.05'),
('referral_silver_threshold','10'),
('referral_gold_threshold','50'),
('referral_silver_multiplier','1.25'),
('referral_gold_multiplier','1.5'),
('rate_usd_try_mode','auto'),
('rate_usd_try_manual','0'),
('rate_usd_irr_mode','manual'),
('rate_usd_irr_manual','0');
