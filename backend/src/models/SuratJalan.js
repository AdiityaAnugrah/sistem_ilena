const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratJalan = sequelize.define('surat_jalan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_offline_id: { type: DataTypes.INTEGER, allowNull: false },
  nomor_surat: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = SuratJalan;
