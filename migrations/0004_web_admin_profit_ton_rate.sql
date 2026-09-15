ALTER TABLE products ADD COLUMN cost_credits REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cost_total REAL NOT NULL DEFAULT 0;

UPDATE orders
SET cost_total = quantity * COALESCE((SELECT cost_credits FROM products WHERE products.id=orders.product_id),0)
WHERE cost_total=0;

INSERT OR IGNORE INTO bot_settings(key,value) VALUES('ton_rate_mode','auto');
INSERT OR IGNORE INTO bot_settings(key,value) VALUES('ton_usd_rate_auto','0');
INSERT OR IGNORE INTO bot_settings(key,value) VALUES('ton_usd_rate_updated_at','');
