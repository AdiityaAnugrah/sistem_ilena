const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratPengantarInterior = sequelize.define('surat_pengantar_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nomor_surat: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  penjualan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  surat_jalan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = SuratPengantarInterior;
