const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OnlineOption = sequelize.define('online_options', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipe: { type: DataTypes.ENUM('PLATFORM', 'METODE_PEMBAYARAN'), allowNull: false },
  nama: { type: DataTypes.STRING(80), allowNull: false },
  active: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
  is_test: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['tipe', 'nama', 'is_test'] }],
});

module.exports = OnlineOption;
