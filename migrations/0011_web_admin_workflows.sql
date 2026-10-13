PRAGMA foreign_keys = ON;

-- Web login identity is bound to the authenticated session, never trusted from form fields.
ALTER TABLE admin_sessions ADD COLUMN admin_telegram_id INTEGER;
ALTER TABLE admin_sessions ADD COLUMN admin_username TEXT;

-- Keep browser drafts separate by authenticated admin, including optional inline-button settings.
ALTER TABLE broadcast_drafts ADD COLUMN button_text TEXT;
ALTER TABLE broadcast_drafts ADD COLUMN button_callback TEXT;
ALTER TABLE broadcast_drafts ADD COLUMN previewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_identity ON admin_sessions(admin_telegram_id, expires_at);
