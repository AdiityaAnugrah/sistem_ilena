const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceOnline = sequelize.define('invoice_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  nomor_invoice: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  jatuh_tempo: { type: DataTypes.DATEONLY, allowNull: true },
  catatan: { type: DataTypes.TEXT },
  printed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = InvoiceOnline;
