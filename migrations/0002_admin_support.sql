CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  sender_telegram_id INTEGER,
  message_type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  file_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ticket_id) REFERENCES support_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id,id);

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_telegram_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(id DESC);

CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  admin_telegram_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  last_user_id INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_broadcast_status ON broadcasts(status,id);

ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'عمومی';
ALTER TABLE products ADD COLUMN warranty_text TEXT;
ALTER TABLE products ADD COLUMN format_text TEXT;
