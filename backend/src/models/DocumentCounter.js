const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentCounter = sequelize.define('document_counter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipe: {
    type: DataTypes.ENUM(
      'SJ_FAKTUR', 'SJ_NON_FAKTUR',
      'INV_FAKTUR', 'INV_NON_FAKTUR',
      'SP_FAKTUR', 'SP_NON_FAKTUR',
      'PROFORMA'
    ),
    allowNull: false,
  },
  bulan: { type: DataTypes.INTEGER, allowNull: false },
  tahun: { type: DataTypes.INTEGER, allowNull: false },
  last_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { timestamps: false });

module.exports = DocumentCounter;
