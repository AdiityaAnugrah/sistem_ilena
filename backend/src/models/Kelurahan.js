const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kelurahan = sequelize.define('kelurahan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provinsi_id: { type: DataTypes.INTEGER },
  kabupaten_id: { type: DataTypes.INTEGER },
  kecamatan_id: { type: DataTypes.INTEGER },
  label: { type: DataTypes.STRING(100) },
  kodepos: { type: DataTypes.STRING(10) },
}, { timestamps: false });

module.exports = Kelurahan;
