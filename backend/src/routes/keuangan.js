const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline, PenjualanOfflineItem, SuratJalan, Invoice,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  sequelize,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const money = (value) => Math.round(Number(value || 0));
const sumItems = (items = []) => items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
const getOfflineProgress = (penjualan) => {
  if (penjualan.status === 'COMPLETED') return { label: 'Lunas / Selesai', level: 100 };
  if (penjualan.invoices?.length > 0) return { label: 'Invoice Dibuat', level: 75 };
  if (penjualan.suratJalans?.length > 0) return { label: 'Surat Jalan Dibuat', level: 50 };
  if (penjualan.status === 'ACTIVE') return { label: 'Aktif / Belum Lunas', level: 25 };
  return { label: 'Draft', level: 10 };
};

// GET /api/keuangan/offline
router.get('/offline', authenticate, async (req, res) => {
  try {
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const { from, to, page = 1, limit = 20, tab = 'penjualan' } = req.query;
    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;

    const dateWhere = {};
    if (from) dateWhere[Op.gte] = from;
    if (to) dateWhere[Op.lte] = to;

    // ── Summary cards (tidak terpengaruh pagination/tab) ─────────────────────

    // Total omzet penjualan langsung
    const penjualanItems = await PenjualanOfflineItem.findAll({
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        where: { tipe: 'PENJUALAN', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) },
        attributes: [],
        required: true,
      }],
      attributes: [[sequelize.fn('SUM', sequelize.col('subtotal')), 'total']],
      raw: true,
    });
    const totalOmzet = money(penjualanItems[0]?.total);

    // Total penjualan offline yang belum ditandai selesai/lunas
    const belumLunasItems = await PenjualanOfflineItem.findAll({
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        where: {
          tipe: 'PENJUALAN',
          status: { [Op.ne]: 'COMPLETED' },
          is_test: isTest,
          ...(from || to ? { tanggal: dateWhere } : {}),
        },
        attributes: [],
        required: true,
      }],
      attributes: [[sequelize.fn('SUM', sequelize.col('subtotal')), 'total']],
      raw: true,
    });
    const totalBelumLunas = money(belumLunasItems[0]?.total);

    // Total nilai display masih aktif (sisa item qty > 0)
    const displayAktif = await PenjualanOffline.findAll({
      where: { tipe: 'DISPLAY', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) },
      include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['qty', 'subtotal'] }],
      attributes: ['id'],
    });
    let totalPiutang = 0;
    for (const d of displayAktif) {
      for (const item of d.items) {
        if (item.qty > 0) totalPiutang += Number(item.subtotal || 0);
      }
    }
    totalPiutang = money(totalPiutang);

    // Total sudah terjual dari display (penjualan dengan display_source_id)
    const terjualItems = await PenjualanOfflineItem.findAll({
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        where: {
          tipe: 'PENJUALAN', is_test: isTest,
          display_source_id: { [Op.not]: null },
          ...(from || to ? { tanggal: dateWhere } : {}),
        },
        attributes: [],
        required: true,
      }],
      attributes: [[sequelize.fn('SUM', sequelize.col('subtotal')), 'total']],
      raw: true,
    });
    const totalTerjualDisplay = money(terjualItems[0]?.total);

    // Total display yang sudah laku tetapi transaksi penjualannya belum selesai/lunas
    const displayBelumLunasItems = await PenjualanOfflineItem.findAll({
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        where: {
          tipe: 'PENJUALAN',
          status: { [Op.ne]: 'COMPLETED' },
          is_test: isTest,
          display_source_id: { [Op.not]: null },
          ...(from || to ? { tanggal: dateWhere } : {}),
        },
        attributes: [],
        required: true,
      }],
      attributes: [[sequelize.fn('SUM', sequelize.col('subtotal')), 'total']],
      raw: true,
    });
    const totalDisplayBelumLunas = money(displayBelumLunasItems[0]?.total);

    const summary = { totalOmzet, totalBelumLunas, totalPiutang, totalTerjualDisplay, totalDisplayBelumLunas };

    // ── List data sesuai tab ──────────────────────────────────────────────────

    if (tab === 'penjualan') {
      const where = { tipe: 'PENJUALAN', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };
      const { count, rows } = await PenjualanOffline.findAndCountAll({
        where,
        include: [
          { model: PenjualanOfflineItem, as: 'items', attributes: ['subtotal'] },
          { model: SuratJalan, as: 'suratJalans', attributes: ['id'] },
          { model: Invoice, as: 'invoices', attributes: ['id'] },
        ],
        order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
        limit: limitInt,
        offset,
        distinct: true,
      });
      const list = rows.map(p => {
        const progress = getOfflineProgress(p);
        return {
          id: p.id,
          tanggal: p.tanggal,
          nama_penerima: p.nama_penerima,
          faktur: p.faktur,
          status: p.status,
          from_display: !!p.display_source_id,
          belumLunas: p.status !== 'COMPLETED',
          lunas: p.status === 'COMPLETED',
          progressLabel: progress.label,
          progressLevel: progress.level,
          total: money(sumItems(p.items)),
        };
      });
      return res.json({
        summary,
        list,
        total: count,
        totalPages: Math.ceil(count / limitInt),
        page: pageInt,
      });
    }

    // tab === 'display'
    const whereDisplay = { tipe: 'DISPLAY', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };
    const { count, rows } = await PenjualanOffline.findAndCountAll({
      where: whereDisplay,
      include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['qty', 'subtotal', 'barang_id', 'varian_nama'] }],
      order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
      limit: limitInt,
      offset,
      distinct: true,
    });

    const displayIds = rows.map(d => d.id);
    // Hitung total yang sudah terjual per display
    const terjualPerDisplay = await PenjualanOffline.findAll({
      where: { display_source_id: { [Op.in]: displayIds.length ? displayIds : [0] }, is_test: isTest },
      include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['subtotal', 'barang_id'] }],
      attributes: ['id', 'display_source_id', 'status'],
    });
    const terjualMap = {};
    const terjualBelumLunasMap = {};
    for (const p of terjualPerDisplay) {
      const srcId = p.display_source_id;
      const totalPenjualan = sumItems(p.items);
      terjualMap[srcId] = (terjualMap[srcId] || 0) + totalPenjualan;
      if (p.status !== 'COMPLETED') {
        terjualBelumLunasMap[srcId] = (terjualBelumLunasMap[srcId] || 0) + totalPenjualan;
      }
    }

    const list = rows.map(d => {
      const nilaiSisa = d.items.filter(i => i.qty > 0).reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const nilaiTerjual = terjualMap[d.id] || 0;
      const nilaiTerjualBelumLunas = terjualBelumLunasMap[d.id] || 0;
      return {
        id: d.id,
        tanggal: d.tanggal,
        nama_penerima: d.nama_penerima,
        status: d.status,
        nilaiSisa: money(nilaiSisa),
        nilaiTerjual: money(nilaiTerjual),
        nilaiTerjualBelumLunas: money(nilaiTerjualBelumLunas),
        nilaiTotal: money(nilaiSisa + nilaiTerjual),
        adaSisa: d.items.some(i => i.qty > 0),
      };
    });

    return res.json({
      summary,
      list,
      total: count,
      totalPages: Math.ceil(count / limitInt),
      page: pageInt,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/keuangan/interior
router.get('/interior', authenticate, async (req, res) => {
  try {
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const { from, to, page = 1, limit = 20 } = req.query;
    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;

    const dateWhere = {};
    if (from) dateWhere[Op.gte] = from;
    if (to) dateWhere[Op.lte] = to;
    const where = { is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };

    // ── Summary cards ─────────────────────────────────────────────────────────

    const allProyek = await PenjualanInterior.findAll({
      where,
      include: [
        { model: PenjualanInteriorItem, as: 'items', attributes: ['subtotal'] },
        { model: PembayaranInterior, as: 'pembayarans', attributes: ['jumlah'] },
      ],
      attributes: ['id', 'pakai_ppn', 'ppn_persen'],
    });

    let totalNilaiProyek = 0, totalTerbayar = 0;
    for (const p of allProyek) {
      const subtotal = sumItems(p.items);
      const ppn = p.pakai_ppn ? subtotal * (parseInt(p.ppn_persen) / 100) : 0;
      totalNilaiProyek += subtotal + ppn;
      totalTerbayar += p.pembayarans.reduce((s, pb) => s + Number(pb.jumlah || 0), 0);
    }
    totalNilaiProyek = money(totalNilaiProyek);
    totalTerbayar = money(totalTerbayar);
    const totalOutstanding = money(Math.max(0, totalNilaiProyek - totalTerbayar));

    // ── List ──────────────────────────────────────────────────────────────────

    const { count, rows } = await PenjualanInterior.findAndCountAll({
      where,
      include: [
        { model: PenjualanInteriorItem, as: 'items', attributes: ['subtotal'] },
        { model: PembayaranInterior, as: 'pembayarans', attributes: ['jumlah', 'tipe', 'tanggal'] },
      ],
      order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
      limit: limitInt,
      offset,
      distinct: true,
    });

    const list = rows.map(p => {
      const subtotal = sumItems(p.items);
      const ppn = p.pakai_ppn ? subtotal * (parseInt(p.ppn_persen) / 100) : 0;
      const grandTotal = money(subtotal + ppn);
      const terbayar = money(p.pembayarans.reduce((s, pb) => s + Number(pb.jumlah || 0), 0));
      const sisa = money(Math.max(0, grandTotal - terbayar));
      const persen = grandTotal > 0 ? Math.min(100, Math.round((terbayar / grandTotal) * 100)) : 0;
      return {
        id: p.id,
        no_po: p.no_po,
        nama_customer: p.nama_customer,
        tanggal: p.tanggal,
        status: p.status,
        faktur: p.faktur,
        pakai_ppn: p.pakai_ppn,
        ppn_persen: p.ppn_persen,
        grandTotal,
        terbayar,
        sisa,
        persen,
        lunas: sisa === 0 && grandTotal > 0,
        pembayarans: p.pembayarans.map(pb => ({ tipe: pb.tipe, jumlah: money(pb.jumlah), tanggal: pb.tanggal })),
      };
    });

    return res.json({
      summary: { totalNilaiProyek, totalTerbayar, totalOutstanding },
      list,
      total: count,
      totalPages: Math.ceil(count / limitInt),
      page: pageInt,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
