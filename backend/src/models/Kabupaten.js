const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kabupaten = sequelize.define('kabupaten', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provinsi_id: { type: DataTypes.INTEGER },
  label: { type: DataTypes.STRING(100) },
}, { timestamps: false });

module.exports = Kabupaten;
