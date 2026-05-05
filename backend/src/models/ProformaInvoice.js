const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProformaInvoice = sequelize.define('proforma_invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  nomor_proforma: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  total: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  catatan: { type: DataTypes.TEXT },
  terms: { type: DataTypes.TEXT, allowNull: true },
  nomor_sub_invoice: { type: DataTypes.STRING(50), allowNull: true, unique: true },
  sub_invoice_sj_ids: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ProformaInvoice;
