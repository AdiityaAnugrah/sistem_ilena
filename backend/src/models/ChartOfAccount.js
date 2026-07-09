const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChartOfAccount = sequelize.define('chart_of_accounts', {
  code: { type: DataTypes.STRING(20), primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  type: {
    type: DataTypes.ENUM('ASET', 'KEWAJIBAN', 'EKUITAS', 'PENDAPATAN', 'BEBAN'),
    allowNull: false,
  },
  normal_balance: {
    type: DataTypes.ENUM('DEBIT', 'KREDIT'),
    allowNull: false,
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  active: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ChartOfAccount;
