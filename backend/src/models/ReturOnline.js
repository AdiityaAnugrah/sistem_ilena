const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturOnline = sequelize.define('retur_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_online_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_retur: { type: DataTypes.INTEGER, allowNull: false },
  retur_group_id: { type: DataTypes.STRING(36), allowNull: true },
  tipe: { type: DataTypes.ENUM('PENGGANTIAN_BARANG', 'PENGEMBALIAN_DANA'), allowNull: false, defaultValue: 'PENGGANTIAN_BARANG' },
  jumlah_refund: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  surat_jalan_awal_id: { type: DataTypes.INTEGER, allowNull: true },
  surat_jalan_pengganti_id: { type: DataTypes.INTEGER, allowNull: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ReturOnline;
