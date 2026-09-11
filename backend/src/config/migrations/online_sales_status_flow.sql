ALTER TABLE `penjualan_online`
  ADD COLUMN `pendapatan_bersih` DECIMAL(15,2) NULL DEFAULT NULL AFTER `catatan`;

ALTER TABLE `invoice_online`
  ADD COLUMN `printed_at` DATETIME NULL DEFAULT NULL AFTER `catatan`;
