const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratPengantarSub = sequelize.define('surat_pengantar_sub', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  surat_pengantar_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_offline_item_id: { type: DataTypes.INTEGER, allowNull: false },
  nomor_sp_sub: { type: DataTypes.STRING(70), allowNull: false, unique: true },
  urutan: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = SuratPengantarSub;
