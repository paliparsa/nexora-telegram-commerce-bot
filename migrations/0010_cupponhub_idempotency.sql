-- CupponHub adapter support; additive and compatible with existing provider orders.
ALTER TABLE provider_orders ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_orders_idempotency_key
  ON provider_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
