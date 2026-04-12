const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LogActivity = sequelize.define('log_activity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING(100), allowNull: false },
  detail: { type: DataTypes.TEXT },
  ip_address: { type: DataTypes.STRING(45) },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = LogActivity;
