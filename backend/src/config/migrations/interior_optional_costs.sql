-- Apply once before deploying the optional Interior costs feature.
-- Existing projects remain NULL (no costs/extra invoice rows).
ALTER TABLE penjualan_interior
  ADD COLUMN biaya_assembly DECIMAL(15,2) NULL DEFAULT NULL,
  ADD COLUMN biaya_kirim DECIMAL(15,2) NULL DEFAULT NULL;
