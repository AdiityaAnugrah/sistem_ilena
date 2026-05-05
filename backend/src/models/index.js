const sequelize = require('../config/database');
const User = require('./User');
const LogActivity = require('./LogActivity');
const Barang = require('./Barang');
const Provinsi = require('./Provinsi');
const Kabupaten = require('./Kabupaten');
const Kecamatan = require('./Kecamatan');
const Kelurahan = require('./Kelurahan');
const PenjualanOffline = require('./PenjualanOffline');
const PenjualanOfflineItem = require('./PenjualanOfflineItem');
const SuratJalan = require('./SuratJalan');
const Invoice = require('./Invoice');
const SuratPengantar = require('./SuratPengantar');
const PenjualanInterior = require('./PenjualanInterior');
const PenjualanInteriorItem = require('./PenjualanInteriorItem');
const ProformaInvoice = require('./ProformaInvoice');
const PembayaranInterior = require('./PembayaranInterior');
const SuratJalanInterior = require('./SuratJalanInterior');
const SuratJalanInteriorItem = require('./SuratJalanInteriorItem');
const InvoiceInterior = require('./InvoiceInterior');
const DocumentCounter = require('./DocumentCounter');
const ReturSJInterior = require('./ReturSJInterior');
const ReturOffline = require('./ReturOffline');
const SuratPengantarSub = require('./SuratPengantarSub');
const TutorialVideo = require('./TutorialVideo');
const HargaKhusus = require('./HargaKhusus');
const SuratPengantarInterior = require('./SuratPengantarInterior');
const SuratPengantarInteriorItem = require('./SuratPengantarInteriorItem');
const AppSetting = require('./AppSetting');

// User associations
User.hasMany(LogActivity, { foreignKey: 'user_id', as: 'activities' });
LogActivity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Alamat associations
Provinsi.hasMany(Kabupaten, { foreignKey: 'provinsi_id', as: 'kabupatens' });
Kabupaten.belongsTo(Provinsi, { foreignKey: 'provinsi_id', as: 'provinsi' });

Kabupaten.hasMany(Kecamatan, { foreignKey: 'kabupaten_id', as: 'kecamatans' });
Kecamatan.belongsTo(Kabupaten, { foreignKey: 'kabupaten_id', as: 'kabupaten' });

Kecamatan.hasMany(Kelurahan, { foreignKey: 'kecamatan_id', as: 'kelurahans' });
Kelurahan.belongsTo(Kecamatan, { foreignKey: 'kecamatan_id', as: 'kecamatan' });

// PenjualanOffline - Alamat associations
PenjualanOffline.belongsTo(Provinsi, { foreignKey: 'pengirim_provinsi_id', as: 'pengirimProvinsi' });
PenjualanOffline.belongsTo(Kabupaten, { foreignKey: 'pengirim_kabupaten_id', as: 'pengirimKabupaten' });
PenjualanOffline.belongsTo(Kecamatan, { foreignKey: 'pengirim_kecamatan_id', as: 'pengirimKecamatan' });
PenjualanOffline.belongsTo(Kelurahan, { foreignKey: 'pengirim_kelurahan_id', as: 'pengirimKelurahan' });
PenjualanOffline.belongsTo(Provinsi, { foreignKey: 'tagihan_provinsi_id', as: 'tagihanProvinsi' });
PenjualanOffline.belongsTo(Kabupaten, { foreignKey: 'tagihan_kabupaten_id', as: 'tagihanKabupaten' });
PenjualanOffline.belongsTo(Kecamatan, { foreignKey: 'tagihan_kecamatan_id', as: 'tagihanKecamatan' });
PenjualanOffline.belongsTo(Kelurahan, { foreignKey: 'tagihan_kelurahan_id', as: 'tagihanKelurahan' });

// PenjualanOffline associations
PenjualanOffline.hasMany(PenjualanOfflineItem, { foreignKey: 'penjualan_offline_id', as: 'items' });
PenjualanOfflineItem.belongsTo(PenjualanOffline, { foreignKey: 'penjualan_offline_id', as: 'penjualan' });

PenjualanOffline.hasMany(SuratJalan, { foreignKey: 'penjualan_offline_id', as: 'suratJalans' });
SuratJalan.belongsTo(PenjualanOffline, { foreignKey: 'penjualan_offline_id', as: 'penjualan' });

PenjualanOffline.hasMany(Invoice, { foreignKey: 'penjualan_offline_id', as: 'invoices' });
Invoice.belongsTo(PenjualanOffline, { foreignKey: 'penjualan_offline_id', as: 'penjualan' });

PenjualanOffline.hasMany(SuratPengantar, { foreignKey: 'penjualan_offline_id', as: 'suratPengantars' });
SuratPengantar.belongsTo(PenjualanOffline, { foreignKey: 'penjualan_offline_id', as: 'penjualan' });

SuratPengantar.hasMany(SuratPengantarSub, { foreignKey: 'surat_pengantar_id', as: 'subs' });
SuratPengantarSub.belongsTo(SuratPengantar, { foreignKey: 'surat_pengantar_id', as: 'suratPengantar' });
SuratPengantarSub.belongsTo(PenjualanOfflineItem, { foreignKey: 'penjualan_offline_item_id', as: 'item' });

PenjualanOffline.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// PenjualanInterior - Alamat associations
PenjualanInterior.belongsTo(Provinsi, { foreignKey: 'alamat_provinsi_id', as: 'alamatProvinsi' });
PenjualanInterior.belongsTo(Kabupaten, { foreignKey: 'alamat_kabupaten_id', as: 'alamatKabupaten' });
PenjualanInterior.belongsTo(Kecamatan, { foreignKey: 'alamat_kecamatan_id', as: 'alamatKecamatan' });
PenjualanInterior.belongsTo(Kelurahan, { foreignKey: 'alamat_kelurahan_id', as: 'alamatKelurahan' });

// PenjualanInterior associations
PenjualanInterior.hasMany(PenjualanInteriorItem, { foreignKey: 'penjualan_interior_id', as: 'items' });
PenjualanInteriorItem.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });

PenjualanInterior.hasMany(ProformaInvoice, { foreignKey: 'penjualan_interior_id', as: 'proformas' });
ProformaInvoice.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });

PenjualanInterior.hasMany(PembayaranInterior, { foreignKey: 'penjualan_interior_id', as: 'pembayarans' });
PembayaranInterior.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });

PenjualanInterior.hasMany(SuratJalanInterior, { foreignKey: 'penjualan_interior_id', as: 'suratJalans' });
SuratJalanInterior.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });

SuratJalanInterior.hasMany(SuratJalanInteriorItem, { foreignKey: 'surat_jalan_interior_id', as: 'items' });
SuratJalanInteriorItem.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' });

SuratJalanInteriorItem.belongsTo(PenjualanInteriorItem, { foreignKey: 'penjualan_interior_item_id', as: 'item' });
PenjualanInteriorItem.hasMany(SuratJalanInteriorItem, { foreignKey: 'penjualan_interior_item_id', as: 'pengiriman' });

PenjualanInterior.hasMany(InvoiceInterior, { foreignKey: 'penjualan_interior_id', as: 'invoices' });
InvoiceInterior.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });

// InvoiceInterior - SuratJalanInterior link (surat jalan ID stored on invoice)
InvoiceInterior.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' });
SuratJalanInterior.hasMany(InvoiceInterior, { foreignKey: 'surat_jalan_interior_id', as: 'invoicesInterior' });

// ReturOffline associations
PenjualanOffline.hasMany(ReturOffline, { foreignKey: 'penjualan_offline_id', as: 'returs' });
ReturOffline.belongsTo(PenjualanOffline, { foreignKey: 'penjualan_offline_id', as: 'penjualan' });
ReturOffline.belongsTo(SuratJalan, { foreignKey: 'surat_jalan_id', as: 'suratJalan' });
ReturOffline.belongsTo(PenjualanOfflineItem, { foreignKey: 'penjualan_offline_item_id', as: 'item' });

// ReturSJInterior associations
SuratJalanInterior.hasMany(ReturSJInterior, { foreignKey: 'surat_jalan_interior_id', as: 'returs' });
ReturSJInterior.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' });
ReturSJInterior.belongsTo(PenjualanInteriorItem, { foreignKey: 'penjualan_interior_item_id', as: 'item' });

// SuratPengantarInterior associations
PenjualanInterior.hasMany(SuratPengantarInterior, { foreignKey: 'penjualan_interior_id', as: 'suratPengantars' });
SuratPengantarInterior.belongsTo(PenjualanInterior, { foreignKey: 'penjualan_interior_id', as: 'penjualan' });
SuratPengantarInterior.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' });
SuratPengantarInterior.hasMany(SuratPengantarInteriorItem, { foreignKey: 'surat_pengantar_interior_id', as: 'items' });
SuratPengantarInteriorItem.belongsTo(SuratPengantarInterior, { foreignKey: 'surat_pengantar_interior_id', as: 'suratPengantar' });

PenjualanInterior.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Barang associations
PenjualanOfflineItem.belongsTo(Barang, { foreignKey: 'barang_id', as: 'barang', constraints: false });

module.exports = {
  sequelize,
  User,
  LogActivity,
  Barang,
  Provinsi,
  Kabupaten,
  Kecamatan,
  Kelurahan,
  PenjualanOffline,
  PenjualanOfflineItem,
  SuratJalan,
  Invoice,
  SuratPengantar,
  PenjualanInterior,
  PenjualanInteriorItem,
  ProformaInvoice,
  PembayaranInterior,
  SuratJalanInterior,
  SuratJalanInteriorItem,
  InvoiceInterior,
  DocumentCounter,
  ReturSJInterior,
  ReturOffline,
  SuratPengantarSub,
  TutorialVideo,
  HargaKhusus,
  SuratPengantarInterior,
  SuratPengantarInteriorItem,
  AppSetting,
};
