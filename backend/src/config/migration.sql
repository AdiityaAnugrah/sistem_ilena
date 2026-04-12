-- ============================================================
-- SISTEM ILENA - Database Migration
-- Run this against the 'sistem_ilena' database in MySQL
-- ============================================================

USE sistem_ilena;

-- Users & Role
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('DEV', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Log Aktivitas
CREATE TABLE IF NOT EXISTS log_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  detail TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Penjualan Offline
CREATE TABLE IF NOT EXISTS penjualan_offline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipe ENUM('PENJUALAN', 'DISPLAY') NOT NULL,
  faktur ENUM('FAKTUR', 'NON_FAKTUR') NOT NULL,
  nama_penerima VARCHAR(100) NOT NULL,
  no_hp_penerima VARCHAR(20) NOT NULL,
  no_po VARCHAR(50) DEFAULT NULL,
  tanggal DATE NOT NULL,
  nama_npwp VARCHAR(100) DEFAULT NULL,
  no_npwp VARCHAR(30) DEFAULT NULL,
  pengirim_provinsi_id INT,
  pengirim_kabupaten_id INT,
  pengirim_kecamatan_id INT,
  pengirim_kelurahan_id INT,
  pengirim_detail TEXT,
  tagihan_sama_pengirim TINYINT(1) DEFAULT 0,
  tagihan_provinsi_id INT,
  tagihan_kabupaten_id INT,
  tagihan_kecamatan_id INT,
  tagihan_kelurahan_id INT,
  tagihan_detail TEXT,
  status ENUM('DRAFT', 'ACTIVE', 'COMPLETED') DEFAULT 'DRAFT',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Item Penjualan Offline
CREATE TABLE IF NOT EXISTS penjualan_offline_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_offline_id INT NOT NULL,
  barang_id VARCHAR(50) NOT NULL,
  varian_nama VARCHAR(50) NULL DEFAULT NULL,
  varian_id VARCHAR(10) NULL DEFAULT NULL,
  qty INT NOT NULL DEFAULT 1,
  harga_satuan DECIMAL(15,2) NOT NULL,
  diskon FLOAT DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (penjualan_offline_id) REFERENCES penjualan_offline(id) ON DELETE CASCADE
);

-- Surat Jalan (offline)
CREATE TABLE IF NOT EXISTS surat_jalan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_offline_id INT NOT NULL,
  nomor_surat VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_offline_id) REFERENCES penjualan_offline(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Invoice (offline)
CREATE TABLE IF NOT EXISTS invoice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_offline_id INT NOT NULL,
  nomor_invoice VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_offline_id) REFERENCES penjualan_offline(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Surat Pengantar (display)
CREATE TABLE IF NOT EXISTS surat_pengantar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_offline_id INT NOT NULL,
  nomor_sp VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_offline_id) REFERENCES penjualan_offline(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Penjualan Interior
CREATE TABLE IF NOT EXISTS penjualan_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faktur ENUM('FAKTUR', 'NON_FAKTUR') NOT NULL,
  no_po VARCHAR(50) NOT NULL,
  nama_customer VARCHAR(100) NOT NULL,
  nama_pt_npwp VARCHAR(150) NOT NULL,
  no_hp VARCHAR(20) NOT NULL,
  no_npwp VARCHAR(30),
  pakai_ppn TINYINT(1) DEFAULT 0,
  ppn_persen ENUM('10', '11') DEFAULT NULL,
  tanggal DATE NOT NULL,
  status ENUM('DRAFT', 'ACTIVE', 'COMPLETED') DEFAULT 'DRAFT',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Item Penjualan Interior
CREATE TABLE IF NOT EXISTS penjualan_interior_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_interior_id INT NOT NULL,
  kode_barang VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INT NOT NULL,
  harga_satuan DECIMAL(15,2) NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  sudah_kirim INT DEFAULT 0,
  FOREIGN KEY (penjualan_interior_id) REFERENCES penjualan_interior(id) ON DELETE CASCADE
);

-- Proforma Invoice
CREATE TABLE IF NOT EXISTS proforma_invoice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_interior_id INT NOT NULL,
  nomor_proforma VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_interior_id) REFERENCES penjualan_interior(id)
);

-- Pembayaran Interior
CREATE TABLE IF NOT EXISTS pembayaran_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_interior_id INT NOT NULL,
  tipe ENUM('DP', 'TERMIN_1', 'TERMIN_2', 'TERMIN_3', 'PELUNASAN_AKHIR') NOT NULL,
  jumlah DECIMAL(15,2) NOT NULL,
  tanggal DATE NOT NULL,
  bukti_bayar VARCHAR(255),
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_interior_id) REFERENCES penjualan_interior(id)
);

-- Surat Jalan Interior
CREATE TABLE IF NOT EXISTS surat_jalan_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_interior_id INT NOT NULL,
  nomor_surat VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_interior_id) REFERENCES penjualan_interior(id)
);

-- Item Surat Jalan Interior
CREATE TABLE IF NOT EXISTS surat_jalan_interior_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  surat_jalan_interior_id INT NOT NULL,
  penjualan_interior_item_id INT NOT NULL,
  qty_kirim INT NOT NULL,
  FOREIGN KEY (surat_jalan_interior_id) REFERENCES surat_jalan_interior(id) ON DELETE CASCADE,
  FOREIGN KEY (penjualan_interior_item_id) REFERENCES penjualan_interior_items(id)
);

-- Invoice Interior
CREATE TABLE IF NOT EXISTS invoice_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjualan_interior_id INT NOT NULL,
  surat_jalan_interior_id INT,
  nomor_invoice VARCHAR(50) UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_interior_id) REFERENCES penjualan_interior(id)
);

-- Retur Surat Jalan Interior
CREATE TABLE IF NOT EXISTS retur_sj_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  surat_jalan_interior_id INT NOT NULL,
  penjualan_interior_item_id INT NOT NULL,
  qty_retur INT NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (surat_jalan_interior_id) REFERENCES surat_jalan_interior(id),
  FOREIGN KEY (penjualan_interior_item_id) REFERENCES penjualan_interior_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Counter Nomor Dokumen
CREATE TABLE IF NOT EXISTS document_counter (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipe ENUM('SJ_FAKTUR', 'SJ_NON_FAKTUR', 'INV_FAKTUR', 'INV_NON_FAKTUR',
            'SP_FAKTUR', 'SP_NON_FAKTUR', 'PROFORMA') NOT NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_counter (tipe, bulan, tahun)
);

-- Default DEV user (password: admin123)
INSERT IGNORE INTO users (username, email, password, role)
VALUES ('dev', 'dev@ilena.com', '$2b$10$lZIsLCpBgsl75ZYXDNsX2OF93otqaxLmXueISHs6.Ld86E.6iAqRe', 'DEV');
