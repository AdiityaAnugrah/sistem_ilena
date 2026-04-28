const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline, PenjualanOfflineItem,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  sequelize,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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
    const totalOmzet = parseFloat(penjualanItems[0]?.total || 0);

    // Total nilai display masih aktif (sisa item qty > 0)
    const displayAktif = await PenjualanOffline.findAll({
      where: { tipe: 'DISPLAY', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) },
      include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['qty', 'subtotal'] }],
      attributes: ['id'],
    });
    let totalPiutang = 0;
    for (const d of displayAktif) {
      for (const item of d.items) {
        if (item.qty > 0) totalPiutang += parseFloat(item.subtotal || 0);
      }
    }

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
    const totalTerjualDisplay = parseFloat(terjualItems[0]?.total || 0);

    // ── List data sesuai tab ──────────────────────────────────────────────────

    if (tab === 'penjualan') {
      const where = { tipe: 'PENJUALAN', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };
      const { count, rows } = await PenjualanOffline.findAndCountAll({
        where,
        include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['subtotal'] }],
        order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
        limit: limitInt,
        offset,
        distinct: true,
      });
      const list = rows.map(p => ({
        id: p.id,
        tanggal: p.tanggal,
        nama_penerima: p.nama_penerima,
        faktur: p.faktur,
        status: p.status,
        total: p.items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0),
      }));
      return res.json({
        summary: { totalOmzet, totalPiutang, totalTerjualDisplay },
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
      attributes: ['id', 'display_source_id'],
    });
    const terjualMap = {};
    for (const p of terjualPerDisplay) {
      const srcId = p.display_source_id;
      terjualMap[srcId] = (terjualMap[srcId] || 0) + p.items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
    }

    const list = rows.map(d => {
      const nilaiSisa = d.items.filter(i => i.qty > 0).reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
      const nilaiTerjual = terjualMap[d.id] || 0;
      return {
        id: d.id,
        tanggal: d.tanggal,
        nama_penerima: d.nama_penerima,
        status: d.status,
        nilaiSisa,
        nilaiTerjual,
        nilaiTotal: nilaiSisa + nilaiTerjual,
        adaSisa: d.items.some(i => i.qty > 0),
      };
    });

    return res.json({
      summary: { totalOmzet, totalPiutang, totalTerjualDisplay },
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
      const subtotal = p.items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
      const ppn = p.pakai_ppn ? subtotal * (parseInt(p.ppn_persen) / 100) : 0;
      totalNilaiProyek += subtotal + ppn;
      totalTerbayar += p.pembayarans.reduce((s, pb) => s + parseFloat(pb.jumlah || 0), 0);
    }
    const totalOutstanding = Math.max(0, totalNilaiProyek - totalTerbayar);

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
      const subtotal = p.items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
      const ppn = p.pakai_ppn ? subtotal * (parseInt(p.ppn_persen) / 100) : 0;
      const grandTotal = subtotal + ppn;
      const terbayar = p.pembayarans.reduce((s, pb) => s + parseFloat(pb.jumlah || 0), 0);
      const sisa = Math.max(0, grandTotal - terbayar);
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
        pembayarans: p.pembayarans.map(pb => ({ tipe: pb.tipe, jumlah: parseFloat(pb.jumlah), tanggal: pb.tanggal })),
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
