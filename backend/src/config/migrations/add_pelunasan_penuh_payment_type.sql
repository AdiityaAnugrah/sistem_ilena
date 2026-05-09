-- ============================================================
-- SISTEM ILENA - Add PELUNASAN_PENUH Payment Type Migration
-- Description: Adds 'PELUNASAN_PENUH' to the tipe ENUM in pembayaran_interior table
-- Requirements: 6.1, 6.2, 6.3, 6.7
-- Date: 2026-05-09
-- ============================================================

USE sistem_ilena;

-- Check if PELUNASAN_PENUH already exists in the ENUM
-- If it exists, skip the ALTER TABLE statement (idempotent)
SET @column_type = (
  SELECT COLUMN_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'sistem_ilena' 
    AND TABLE_NAME = 'pembayaran_interior' 
    AND COLUMN_NAME = 'tipe'
);

-- Only execute ALTER TABLE if PELUNASAN_PENUH is not already in the ENUM
SET @alter_sql = IF(
  @column_type LIKE '%PELUNASAN_PENUH%',
  'SELECT "PELUNASAN_PENUH already exists in tipe ENUM, skipping migration" AS message',
  'ALTER TABLE pembayaran_interior 
   MODIFY COLUMN tipe ENUM(''DP'', ''TERMIN_1'', ''TERMIN_2'', ''TERMIN_3'', ''PELUNASAN_AKHIR'', ''PELUNASAN_PENUH'') NOT NULL'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the migration
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'sistem_ilena' 
  AND TABLE_NAME = 'pembayaran_interior' 
  AND COLUMN_NAME = 'tipe';
