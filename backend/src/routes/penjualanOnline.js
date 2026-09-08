const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  PenjualanOnline,
  PenjualanOnlineItem,
  PembayaranOnline,
  ReturOnline,
  Barang,
  Provinsi,
  Kabupaten,
  Kecamatan,
  Kelurahan,
} = require('../models');
const BarangTest = require('../models/BarangTest');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');
const { emitDataUpdated } = require('../socket');

const router = express.Router();
const money = (value) => Math.round(Number(value || 0));

const CHANNELS = ['SHOPEE', 'TOKOPEDIA', 'TIKTOK', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'LAINNYA'];
const METODE = ['TRANSFER', 'COD', 'QRIS', 'EDC', 'MARKETPLACE', 'LAINNYA'];
const STATUS = ['DIPROSES', 'DIKIRIM', 'SELESAI', 'DIBATALKAN', 'RETUR'];

const includeAlamat = [
  { model: Provinsi, as: 'provinsi' },
  { model: Kabupaten, as: 'kabupaten' },
  { model: Kecamatan, as: 'kecamatan' },
  { model: Kelurahan, as: 'kelurahan' },
];

const fullInclude = [
  { model: PenjualanOnlineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
  { model: PembayaranOnline, as: 'pembayarans' },
  { model: ReturOnline, as: 'returs', include: [{ model: PenjualanOnlineItem, as: 'item' }] },
  ...includeAlamat,
];

async function adjustStok(items, isTest, direction = 'deduct') {
  const BarangModel = isTest ? BarangTest : Barang;
  for (const item of items) {
    if (!item.barang_id) continue;
    const barang = await BarangModel.findByPk(item.barang_id);
    if (!barang || !barang.varian) continue;
    let varians = [];
    try { varians = JSON.parse(barang.varian); } catch { varians = []; }
    if (!Array.isArray(varians) || varians.length === 0) continue;

    let updated = false;
    const delta = Number(item.qty || item.qty_retur || 0) * (direction === 'restore' ? 1 : -1);
    if (item.varian_id) {
      varians = varians.map(v => {
        if (String(v.id) === String(item.varian_id)) {
          updated = true;
          return { ...v, stok: String(Math.max(0, Number(v.stok || 0) + delta)) };
        }
        return v;
      });
    } else {
      varians[0] = { ...varians[0], stok: String(Math.max(0, Number(varians[0].stok || 0) + delta)) };
      updated = true;
    }
    if (updated) await barang.update({ varian: JSON.stringify(varians) });
  }
}

function applyOnlineSummary(penjualan) {
  const data = typeof penjualan.toJSON === 'function' ? penjualan.toJSON() : penjualan;
  const returByItemId = {};
  for (const retur of (data.returs || [])) {
    const itemId = Number(retur.penjualan_online_item_id);
    returByItemId[itemId] = (returByItemId[itemId] || 0) + Number(retur.qty_retur || 0);
  }

  let subtotalGross = 0;
  let nilaiRetur = 0;
  let subtotalNet = 0;
  let qtyGross = 0;
  let qtyRetur = 0;

  data.items = (data.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const subtotal = money(item.subtotal);
    const returQty = Math.max(0, Number(returByItemId[item.id] || 0));
    const unit = qty > 0 ? subtotal / qty : 0;
    const itemRetur = money(unit * returQty);
    const itemNet = Math.max(0, money(subtotal - itemRetur));
    subtotalGross += subtotal;
    nilaiRetur += itemRetur;
    subtotalNet += itemNet;
    qtyGross += qty;
    qtyRetur += returQty;
    return {
      ...item,
      qty_retur_total: returQty,
      qty_net: Math.max(0, qty - returQty),
      nilai_retur: itemRetur,
      subtotal_net: itemNet,
    };
  });

  const totalTagihan = money(subtotalNet + Number(data.ongkir || 0) + Number(data.biaya_lain || 0) - Number(data.diskon_order || 0));
  const totalBayar = money((data.pembayarans || []).reduce((s, p) => s + Number(p.jumlah || 0), 0));
  return {
    ...data,
    subtotal_gross: money(subtotalGross),
    total_retur: money(nilaiRetur),
    subtotal_net: money(subtotalNet),
    total_tagihan: Math.max(0, totalTagihan),
    total_bayar: totalBayar,
    sisa_tagihan: Math.max(0, totalTagihan - totalBayar),
    qty_gross: qtyGross,
    qty_retur: qtyRetur,
    qty_net: Math.max(0, qtyGross - qtyRetur),
  };
}

router.post('/', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      id_pesanan, channel, nama_pelanggan, no_hp, metode_pembayaran, jasa_kirim, nomor_resi,
      tanggal, provinsi_id, kabupaten_id, kecamatan_id, kelurahan_id, alamat_detail, kode_pos,
      ongkir = 0, biaya_lain = 0, diskon_order = 0, kurangi_stok = true, catatan, items,
    } = req.body;

    if (!id_pesanan || !nama_pelanggan || !no_hp || !jasa_kirim || !alamat_detail) {
      await t.rollback();
      return res.status(400).json({ message: 'ID Pesanan, nama pelanggan, nomor telepon, jasa kirim, dan alamat wajib diisi' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 produk wajib diisi' });
    }

    const is_test = req.user.role === 'TEST' ? 1 : 0;
    const exists = await PenjualanOnline.findOne({ where: { id_pesanan, is_test }, transaction: t });
    if (exists) {
      await t.rollback();
      return res.status(400).json({ message: 'ID Pesanan sudah digunakan' });
    }

    const online = await PenjualanOnline.create({
      id_pesanan: String(id_pesanan).trim(),
      channel: CHANNELS.includes(String(channel).toUpperCase()) ? String(channel).toUpperCase() : 'LAINNYA',
      nama_pelanggan,
      no_hp,
      metode_pembayaran: METODE.includes(String(metode_pembayaran).toUpperCase()) ? String(metode_pembayaran).toUpperCase() : 'LAINNYA',
      jasa_kirim,
      nomor_resi: nomor_resi || null,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      provinsi_id: provinsi_id || null,
      kabupaten_id: kabupaten_id || null,
      kecamatan_id: kecamatan_id || null,
      kelurahan_id: kelurahan_id || null,
      alamat_detail,
      kode_pos: kode_pos || null,
      ongkir: money(ongkir),
      biaya_lain: money(biaya_lain),
      diskon_order: money(diskon_order),
      kurangi_stok: kurangi_stok ? 1 : 0,
      catatan: catatan || null,
      status: nomor_resi ? 'DIKIRIM' : 'DIPROSES',
      is_test,
      created_by: req.user.id,
    }, { transaction: t });

    const itemRows = items.map(item => ({
      penjualan_online_id: online.id,
      barang_id: item.barang_id,
      varian_nama: item.varian_nama || null,
      varian_id: item.varian_id || null,
      qty: Number(item.qty || 1),
      harga_satuan: money(item.harga_satuan),
      diskon: Number(item.diskon || 0),
      subtotal: money(Number(item.qty || 1) * Number(item.harga_satuan || 0) * (1 - Math.max(0, Number(item.diskon || 0)) / 100)),
    }));
    await PenjualanOnlineItem.bulkCreate(itemRows, { transaction: t });

    const totalProduk = itemRows.reduce((s, item) => s + Number(item.subtotal || 0), 0);
    const totalTagihan = money(totalProduk + Number(ongkir || 0) + Number(biaya_lain || 0) - Number(diskon_order || 0));
    await PembayaranOnline.create({
      penjualan_online_id: online.id,
      metode: online.metode_pembayaran,
      jumlah: Math.max(0, totalTagihan),
      tanggal: online.tanggal,
      catatan: 'Pembayaran otomatis dari input pesanan online',
      created_by: req.user.id,
    }, { transaction: t });

    await t.commit();
    if (online.kurangi_stok === 1) {
      await adjustStok(itemRows, is_test === 1, 'deduct');
    }
    await logAction(req.user.id, 'BUAT_PENJUALAN_ONLINE', `ID Pesanan: ${online.id_pesanan}, Channel: ${online.channel}`, req.ip);
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.status(201).json({ id: online.id, message: 'Penjualan online berhasil dibuat' });
  } catch (err) {
    await t.rollback().catch(() => {});
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, channel, status, tanggal_dari, tanggal_sampai, page = 1, limit = 20 } = req.query;
    const where = { is_test: req.user.role === 'TEST' ? 1 : 0 };
    if (channel) where.channel = String(channel).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (tanggal_dari || tanggal_sampai) {
      where.tanggal = {};
      if (tanggal_dari) where.tanggal[Op.gte] = tanggal_dari;
      if (tanggal_sampai) where.tanggal[Op.lte] = tanggal_sampai;
    }
    if (search) {
      where[Op.or] = [
        { id_pesanan: { [Op.like]: `%${search}%` } },
        { nama_pelanggan: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
        { nomor_resi: { [Op.like]: `%${search}%` } },
      ];
    }

    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageInt - 1) * limitInt;

    const summaryRows = await PenjualanOnline.findAll({
      where,
      include: [
        { model: PenjualanOnlineItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        { model: PembayaranOnline, as: 'pembayarans', attributes: ['jumlah'] },
        { model: ReturOnline, as: 'returs', attributes: ['penjualan_online_item_id', 'qty_retur'] },
      ],
    });
    const summary = summaryRows.map(applyOnlineSummary).reduce((acc, row) => {
      acc.totalNilai += Number(row.total_tagihan || 0);
      acc.totalBayar += Number(row.total_bayar || 0);
      acc.totalRetur += Number(row.total_retur || 0);
      acc.totalQty += Number(row.qty_net || 0);
      return acc;
    }, { totalNilai: 0, totalBayar: 0, totalRetur: 0, totalQty: 0 });

    const { count, rows } = await PenjualanOnline.findAndCountAll({
      where,
      include: [
        { model: PenjualanOnlineItem, as: 'items', include: [{ model: Barang, as: 'barang' }], separate: true },
        { model: PembayaranOnline, as: 'pembayarans', separate: true },
        { model: ReturOnline, as: 'returs', separate: true },
      ],
      order: [['created_at', 'DESC']],
      limit: limitInt,
      offset,
      distinct: true,
    });

    return res.json({
      data: rows.map(applyOnlineSummary),
      total: count,
      page: pageInt,
      totalPages: Math.ceil(count / limitInt),
      summary: {
        totalNilai: money(summary.totalNilai),
        totalBayar: money(summary.totalBayar),
        totalRetur: money(summary.totalRetur),
        totalQty: summary.totalQty,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id, { include: fullInclude });
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    return res.json(applyOnlineSummary(online));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    const status = String(req.body.status || '').toUpperCase();
    if (!STATUS.includes(status)) return res.status(400).json({ message: 'Status tidak valid' });
    await online.update({ status });
    await logAction(req.user.id, 'UPDATE_STATUS_ONLINE', `Penjualan Online #${online.id} → ${status}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.json({ message: 'Status berhasil diperbarui', status });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/resi', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    await online.update({
      nomor_resi: req.body.nomor_resi || null,
      jasa_kirim: req.body.jasa_kirim || online.jasa_kirim,
      status: req.body.nomor_resi ? 'DIKIRIM' : online.status,
    });
    await logAction(req.user.id, 'UPDATE_RESI_ONLINE', `Penjualan Online #${online.id}, Resi: ${req.body.nomor_resi || '-'}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.json({ message: 'Resi berhasil diperbarui' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/retur', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const online = await PenjualanOnline.findByPk(req.params.id, {
      include: [{ model: PenjualanOnlineItem, as: 'items' }, { model: ReturOnline, as: 'returs' }],
      transaction: t,
    });
    if (!online) {
      await t.rollback();
      return res.status(404).json({ message: 'Penjualan online tidak ditemukan' });
    }
    const { tanggal, catatan, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 item retur wajib diisi' });
    }
    const existing = {};
    for (const r of online.returs || []) existing[r.penjualan_online_item_id] = (existing[r.penjualan_online_item_id] || 0) + Number(r.qty_retur || 0);

    const restoreItems = [];
    for (const row of items) {
      const itemId = Number(row.penjualan_online_item_id);
      const qtyRetur = Number(row.qty_retur);
      const item = (online.items || []).find(i => Number(i.id) === itemId);
      if (!item || !qtyRetur || qtyRetur <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Item retur tidak valid' });
      }
      const sisa = Math.max(0, Number(item.qty || 0) - Number(existing[itemId] || 0));
      if (qtyRetur > sisa) {
        await t.rollback();
        return res.status(400).json({ message: `Qty retur melebihi sisa retur untuk ${item.varian_nama || item.barang_id}. Sisa: ${sisa}` });
      }
      await ReturOnline.create({
        penjualan_online_id: online.id,
        penjualan_online_item_id: itemId,
        qty_retur: qtyRetur,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        catatan: catatan || null,
        created_by: req.user.id,
      }, { transaction: t });
      restoreItems.push({ ...item.dataValues, qty: qtyRetur });
    }
    await online.update({ status: 'RETUR' }, { transaction: t });
    await t.commit();
    if (online.kurangi_stok === 1) {
      await adjustStok(restoreItems, online.is_test === 1, 'restore');
    }
    await logAction(req.user.id, 'CATAT_RETUR_ONLINE', `Penjualan Online #${online.id}, ${restoreItems.length} item`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.status(201).json({ message: 'Retur online berhasil dicatat' });
  } catch (err) {
    await t.rollback().catch(() => {});
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
