const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturOffline = sequelize.define('retur_offline', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_offline_id: { type: DataTypes.INTEGER, allowNull: false },
  surat_jalan_id: { type: DataTypes.INTEGER, allowNull: true },
  penjualan_offline_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_retur: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ReturOffline;
