const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratJalanOnline = sequelize.define('surat_jalan_online', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_online_id: { type: DataTypes.INTEGER, allowNull: false },
  nomor_surat: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT },
  jenis: { type: DataTypes.ENUM('PENGIRIMAN_AWAL', 'PENGGANTIAN_RETUR'), allowNull: false, defaultValue: 'PENGIRIMAN_AWAL' },
  retur_group_id: { type: DataTypes.STRING(36), allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = SuratJalanOnline;
