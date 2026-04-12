const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanInterior = sequelize.define('penjualan_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  faktur: { type: DataTypes.ENUM('FAKTUR', 'NON_FAKTUR'), allowNull: false },
  no_po: { type: DataTypes.STRING(50), allowNull: false },
  nama_customer: { type: DataTypes.STRING(100), allowNull: false },
  nama_pt_npwp: { type: DataTypes.STRING(150), allowNull: false },
  no_hp: { type: DataTypes.STRING(20), allowNull: false },
  no_npwp: { type: DataTypes.STRING(30) },
  pakai_ppn: { type: DataTypes.TINYINT(1), defaultValue: 0 },
  ppn_persen: { type: DataTypes.ENUM('10', '11'), defaultValue: null },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'COMPLETED'), defaultValue: 'DRAFT' },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PenjualanInterior;
