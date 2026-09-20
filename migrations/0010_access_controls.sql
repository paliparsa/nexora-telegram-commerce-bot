ALTER TABLE users ADD COLUMN phone_number TEXT;
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified, telegram_id);

-- Preserve the existing required-channel behaviour after upgrade.
INSERT OR IGNORE INTO bot_settings(key,value) VALUES('feature_required_join','1');
-- Phone verification is opt-in and can be enabled from Telegram Admin.
INSERT OR IGNORE INTO bot_settings(key,value) VALUES('feature_phone_verification','0');
