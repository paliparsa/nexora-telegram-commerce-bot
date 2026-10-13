-- Multi-provider credentials are encrypted at rest; encryption key is a Worker secret.
ALTER TABLE providers ADD COLUMN api_base TEXT;
ALTER TABLE providers ADD COLUMN api_key_ciphertext TEXT;
ALTER TABLE providers ADD COLUMN config_updated_at TEXT;
-- CupponHub adapter idempotency; additive and compatible with existing orders.
ALTER TABLE provider_orders ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_orders_idempotency_key
  ON provider_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
