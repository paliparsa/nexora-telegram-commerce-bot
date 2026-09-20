PRAGMA foreign_keys = ON;
ALTER TABLE payment_invoices ADD COLUMN requested_toman INTEGER;
ALTER TABLE payment_invoices ADD COLUMN fx_rate REAL;
ALTER TABLE delivery_types ADD COLUMN template_preset TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE broadcasts ADD COLUMN button_text TEXT;
ALTER TABLE broadcasts ADD COLUMN button_callback TEXT;
INSERT OR IGNORE INTO bot_settings(key,value) VALUES ('wallex_rate_enabled','1'),('wallex_rate_cache_minutes','5');
