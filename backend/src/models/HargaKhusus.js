const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HargaKhusus = sequelize.define('harga_khusus', {
  barang_id: { type: DataTypes.STRING(50), primaryKey: true },
  harga: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
}, { timestamps: false });

module.exports = HargaKhusus;
