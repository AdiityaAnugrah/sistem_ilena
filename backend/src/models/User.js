const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  nama_lengkap: { type: DataTypes.STRING(100), allowNull: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA', 'TEST'),
    allowNull: false,
    defaultValue: 'PENGGUNA',
  },
  active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = User;
