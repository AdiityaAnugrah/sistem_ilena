const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanOnline = sequelize.define('penjualan_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_pesanan: { type: DataTypes.STRING(80), allowNull: false },
  channel: {
    type: DataTypes.ENUM('SHOPEE', 'TOKOPEDIA', 'TIKTOK', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'LAINNYA'),
    allowNull: false,
    defaultValue: 'LAINNYA',
  },
  nama_pelanggan: { type: DataTypes.STRING(120), allowNull: false },
  no_hp: { type: DataTypes.STRING(25), allowNull: false },
  metode_pembayaran: {
    type: DataTypes.ENUM('TRANSFER', 'COD', 'QRIS', 'EDC', 'MARKETPLACE', 'LAINNYA'),
    allowNull: false,
  },
  jasa_kirim: { type: DataTypes.STRING(80), allowNull: false },
  nomor_resi: { type: DataTypes.STRING(100), defaultValue: null },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  provinsi_id: { type: DataTypes.INTEGER, defaultValue: null },
  kabupaten_id: { type: DataTypes.INTEGER, defaultValue: null },
  kecamatan_id: { type: DataTypes.INTEGER, defaultValue: null },
  kelurahan_id: { type: DataTypes.INTEGER, defaultValue: null },
  alamat_detail: { type: DataTypes.TEXT, allowNull: false },
  kode_pos: { type: DataTypes.STRING(10), defaultValue: null },
  ongkir: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  biaya_lain: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  diskon_order: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  kurangi_stok: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
  catatan: { type: DataTypes.TEXT, defaultValue: null },
  status: {
    type: DataTypes.ENUM('DIPROSES', 'DIKIRIM', 'SELESAI', 'DIBATALKAN', 'RETUR'),
    allowNull: false,
    defaultValue: 'DIPROSES',
  },
  is_test: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['id_pesanan', 'is_test'] },
  ],
});

module.exports = PenjualanOnline;
