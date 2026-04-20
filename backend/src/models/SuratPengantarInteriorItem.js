const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuratPengantarInteriorItem = sequelize.define('surat_pengantar_interior_item', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  surat_pengantar_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_interior_item_id: { type: DataTypes.INTEGER, allowNull: false },
  nama_barang: { type: DataTypes.STRING(150), allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps: false });

module.exports = SuratPengantarInteriorItem;
