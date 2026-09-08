const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturOnline = sequelize.define('retur_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_online_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_retur: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ReturOnline;
