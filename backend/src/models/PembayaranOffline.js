const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PembayaranOffline = sequelize.define('pembayaran_offline', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_offline_id: { type: DataTypes.INTEGER, allowNull: false },
  metode: {
    type: DataTypes.ENUM('TRANSFER', 'TUNAI', 'QRIS', 'EDC', 'MARKETPLACE', 'LAINNYA'),
    allowNull: false,
  },
  jumlah: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  bukti_bayar: { type: DataTypes.STRING(255), allowNull: true },
  catatan: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = PembayaranOffline;
