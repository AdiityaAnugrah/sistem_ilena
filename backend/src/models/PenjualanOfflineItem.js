const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanOfflineItem = sequelize.define('penjualan_offline_items', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_offline_id: { type: DataTypes.INTEGER, allowNull: false },
  barang_id: { type: DataTypes.STRING(50), allowNull: false },
  varian_nama: { type: DataTypes.STRING(50), defaultValue: null },
  varian_id: { type: DataTypes.STRING(10), defaultValue: null },
  qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  harga_satuan: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  diskon: { type: DataTypes.FLOAT, defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
}, { timestamps: false });

module.exports = PenjualanOfflineItem;
