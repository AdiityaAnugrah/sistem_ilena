const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('pencairan_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  referensi: { type: DataTypes.STRING(120), allowNull: false },
  jumlah_bruto: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  biaya: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  jumlah_bersih: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps: true, createdAt: 'created_at', updatedAt: false,
  indexes: [{ unique: true, fields: ['penjualan_online_id', 'referensi'] }] });
