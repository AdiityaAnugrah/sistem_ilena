const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratJalanInteriorItem = sequelize.define('surat_jalan_interior_items', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  surat_jalan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_interior_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_kirim: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps: false });

module.exports = SuratJalanInteriorItem;
