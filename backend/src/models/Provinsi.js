const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Provinsi = sequelize.define('provinsi', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  label: { type: DataTypes.STRING(100) },
}, { timestamps: false });

module.exports = Provinsi;
