const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PembayaranInterior = sequelize.define('pembayaran_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  penjualan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  tipe: {
    type: DataTypes.ENUM('DP', 'TERMIN_1', 'TERMIN_2', 'TERMIN_3', 'PELUNASAN_AKHIR', 'PELUNASAN_PENUH'),
    allowNull: false,
  },
  jumlah: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  bukti_bayar: { type: DataTypes.STRING(255) },
  catatan: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = PembayaranInterior;
