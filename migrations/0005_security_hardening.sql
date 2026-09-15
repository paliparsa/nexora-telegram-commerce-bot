PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS security_guards (
  tag TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id INTEGER NOT NULL,
  order_public_id TEXT NOT NULL UNIQUE,
  telegram_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(discount_id) REFERENCES discount_codes(id)
);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_discount ON discount_redemptions(discount_id, id DESC);

DELETE FROM credit_ledger
WHERE kind='purchase' AND ref_type='order' AND ref_id IS NOT NULL
  AND id NOT IN (SELECT MIN(id) FROM credit_ledger WHERE kind='purchase' AND ref_type='order' AND ref_id IS NOT NULL GROUP BY ref_id);

DELETE FROM credit_ledger
WHERE kind='topup' AND ref_type='payment' AND ref_id IS NOT NULL
  AND id NOT IN (SELECT MIN(id) FROM credit_ledger WHERE kind='topup' AND ref_type='payment' AND ref_id IS NOT NULL GROUP BY ref_id);

DELETE FROM credit_ledger
WHERE kind='refund' AND ref_type='order' AND ref_id IS NOT NULL
  AND id NOT IN (SELECT MIN(id) FROM credit_ledger WHERE kind='refund' AND ref_type='order' AND ref_id IS NOT NULL GROUP BY ref_id);

UPDATE payment_invoices SET tx_hash=lower(tx_hash) WHERE tx_hash IS NOT NULL AND tx_hash<>'';

UPDATE payment_invoices
SET tx_hash=NULL
WHERE tx_hash IS NOT NULL AND tx_hash<>''
  AND id NOT IN (SELECT MIN(id) FROM payment_invoices WHERE tx_hash IS NOT NULL AND tx_hash<>'' GROUP BY tx_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_order_purchase_unique
ON credit_ledger(ref_id)
WHERE kind='purchase' AND ref_type='order';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_payment_topup_unique
ON credit_ledger(ref_id)
WHERE kind='topup' AND ref_type='payment';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_order_refund_unique
ON credit_ledger(ref_id)
WHERE kind='refund' AND ref_type='order';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tx_hash_unique
ON payment_invoices(tx_hash)
WHERE tx_hash IS NOT NULL AND tx_hash <> '';


CREATE TABLE IF NOT EXISTS payment_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL UNIQUE,
  claim_token TEXT NOT NULL UNIQUE,
  tx_hash TEXT,
  settlement_kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_id) REFERENCES payment_invoices(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_settlements_tx
ON payment_settlements(tx_hash)
WHERE tx_hash IS NOT NULL AND tx_hash <> '';

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_updated ON admin_login_attempts(updated_at);
