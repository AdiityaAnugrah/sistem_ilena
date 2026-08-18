const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MutasiDisplay = sequelize.define('mutasi_display', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nomor_mutasi: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  display_asal_id: { type: DataTypes.INTEGER, allowNull: false },
  display_tujuan_id: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = MutasiDisplay;
