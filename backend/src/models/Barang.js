const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Barang = sequelize.define('barang', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  nama: { type: DataTypes.STRING(50) },
  pencarian: { type: DataTypes.TEXT('long') },
  harga: { type: DataTypes.STRING(255) }, // varchar di DB
  rate: { type: DataTypes.INTEGER },
  deskripsi: { type: DataTypes.TEXT('long') },
  kategori: { type: DataTypes.STRING(50) },
  subkategori: { type: DataTypes.STRING(50) },
  diskon: { type: DataTypes.FLOAT },
  pakai_jadwal_diskon: { type: DataTypes.TINYINT },
  diskon_mulai: { type: DataTypes.DATE },
  diskon_selesai: { type: DataTypes.DATE },
  varian: { type: DataTypes.TEXT('long') },
  shopee: { type: DataTypes.STRING(255) },
  tokped: { type: DataTypes.STRING(255) },
  tiktok: { type: DataTypes.STRING(255) },
  active: { type: DataTypes.TINYINT(1) },
  pengunjung: { type: DataTypes.INTEGER },
  ruang_tamu: { type: DataTypes.TINYINT(1) },
  ruang_keluarga: { type: DataTypes.TINYINT(1) },
  ruang_tidur: { type: DataTypes.TINYINT(1) },
  tgl_update: { type: DataTypes.DATE },
}, {
  timestamps: false,
});

module.exports = Barang;
