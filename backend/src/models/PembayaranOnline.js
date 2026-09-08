const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PembayaranOnline = sequelize.define('pembayaran_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  metode: { type: DataTypes.STRING(80), allowNull: false },
  jumlah: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = PembayaranOnline;
