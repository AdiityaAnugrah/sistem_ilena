const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanInteriorItem = sequelize.define('penjualan_interior_items', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  kode_barang: { type: DataTypes.STRING(50), allowNull: false },
  nama_barang: { type: DataTypes.STRING(150), allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false },
  harga_satuan: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  sudah_kirim: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: false });

module.exports = PenjualanInteriorItem;
