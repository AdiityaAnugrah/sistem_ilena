const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentCounter = sequelize.define('document_counter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipe: { type: DataTypes.STRING(30), allowNull: false },
  bulan: { type: DataTypes.INTEGER, allowNull: false },
  tahun: { type: DataTypes.INTEGER, allowNull: false },
  last_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { timestamps: false });

module.exports = DocumentCounter;
