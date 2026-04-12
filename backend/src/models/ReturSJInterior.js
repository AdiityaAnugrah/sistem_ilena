const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturSJInterior = sequelize.define('retur_sj_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  surat_jalan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_interior_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_retur: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ReturSJInterior;
