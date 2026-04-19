const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanOffline = sequelize.define('penjualan_offline', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipe: { type: DataTypes.ENUM('PENJUALAN', 'DISPLAY'), allowNull: false },
  faktur: { type: DataTypes.ENUM('FAKTUR', 'NON_FAKTUR'), allowNull: false },
  nama_penerima: { type: DataTypes.STRING(100), allowNull: false },
  no_hp_penerima: { type: DataTypes.STRING(20), allowNull: false },
  no_po: { type: DataTypes.STRING(50), defaultValue: null },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  nama_npwp: { type: DataTypes.STRING(100), defaultValue: null },
  no_npwp: { type: DataTypes.STRING(30), defaultValue: null },
  pengirim_provinsi_id: { type: DataTypes.INTEGER },
  pengirim_kabupaten_id: { type: DataTypes.INTEGER },
  pengirim_kecamatan_id: { type: DataTypes.INTEGER },
  pengirim_kelurahan_id: { type: DataTypes.INTEGER },
  pengirim_detail: { type: DataTypes.TEXT },
  pengirim_kode_pos: { type: DataTypes.STRING(10), defaultValue: null },
  tagihan_sama_pengirim: { type: DataTypes.TINYINT(1), defaultValue: 0 },
  tagihan_provinsi_id: { type: DataTypes.INTEGER },
  tagihan_kabupaten_id: { type: DataTypes.INTEGER },
  tagihan_kecamatan_id: { type: DataTypes.INTEGER },
  tagihan_kelurahan_id: { type: DataTypes.INTEGER },
  tagihan_detail: { type: DataTypes.TEXT },
  tagihan_kode_pos: { type: DataTypes.STRING(10), defaultValue: null },
  status: { type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'COMPLETED'), defaultValue: 'DRAFT' },
  is_test: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
  display_source_id: { type: DataTypes.INTEGER, defaultValue: null },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PenjualanOffline;
