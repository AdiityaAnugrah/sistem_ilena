const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceInterior = sequelize.define('invoice_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  surat_jalan_interior_id: { type: DataTypes.INTEGER },
  surat_jalan_ids: { type: DataTypes.TEXT, allowNull: true }, // JSON array of SJ IDs
  nomor_invoice: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  jatuh_tempo: { type: DataTypes.DATEONLY, allowNull: true },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = InvoiceInterior;
