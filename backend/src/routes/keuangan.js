const express = require('express');
const { Op } = require('sequelize');
const { PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, Invoice, SuratPengantar, ReturOffline, sequelize } = require('../models');
const { financeDateRangeError } = require('../utils/financeDateRange');
const { authenticate } = require('../middleware/auth');

const { createInvoiceBasis, invoiceProjects } = require('../utils/invoiceBasis');
const invoiceBasis = createInvoiceBasis(require('../models'));
const router = express.Router();

const money = (value) => Math.round(Number(value || 0));
const itemNetSubtotal = (item, returQty = 0) => {
  const qty = Number(item.qty || 0);
  const subtotal = Number(item.subtotal || 0);
  if (qty <= 0 || subtotal <= 0) return 0;
  const unitPrice = subtotal / qty;
  return Math.max(0, subtotal - (Number(returQty || 0) * unitPrice));
};
const getReturQtyMap = async (itemIds = []) => {
  const ids = [...new Set(itemIds.filter(Boolean).map(Number))];
  if (ids.length === 0) return {};
  const rows = await ReturOffline.findAll({
    where: { penjualan_offline_item_id: { [Op.in]: ids } },
    attributes: [
      'penjualan_offline_item_id',
      [sequelize.fn('SUM', sequelize.col('qty_retur')), 'total_retur'],
    ],
    group: ['penjualan_offline_item_id'],
    raw: true,
  });
  return rows.reduce((map, row) => {
    map[row.penjualan_offline_item_id] = Number(row.total_retur || 0);
    return map;
  }, {});
};

// GET /api/keuangan/offline
router.get('/offline', authenticate, async (req, res) => {
  try {
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const { from, to, page = 1, limit = 20, tab = 'penjualan', search = '' } = req.query;
    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;

    const dateWhere = {};
    if (from) dateWhere[Op.gte] = from;
    if (to) dateWhere[Op.lte] = to;

    const invoiceData = await invoiceBasis.load({ source: 'OFFLINE', isTest, to });
    const invoiced = invoiceProjects(invoiceData, { source: 'OFFLINE', from, to });
    const totalOmzet = money(invoiced.reduce((sum, row) => sum + row.net, 0));
    const totalBelumLunas = money(invoiced.filter(row => row.due > 0).reduce((sum, row) => sum + row.due, 0));

    // Barang Display beredar tetap dilaporkan sebagai inventori, bukan piutang invoice.
    // Date filter untuk angka ini mengikuti tanggal Surat Pengantar, bukan tanggal input display.
    const displayBerSpAktif = await PenjualanOffline.findAll({
      where: {
        tipe: 'DISPLAY',
        status: { [Op.ne]: 'COMPLETED' },
        is_test: isTest,
      },
      include: [
        { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        {
          model: SuratPengantar,
          as: 'suratPengantars',
          attributes: ['id', 'nomor_sp', 'tanggal'],
          required: true,
          ...(from || to ? { where: { tanggal: dateWhere } } : {}),
        },
      ],
      attributes: ['id'],
      distinct: true,
    });
    const displayReturQtyMap = await getReturQtyMap(
      displayBerSpAktif.flatMap(d => (d.items || []).map(item => item.id))
    );
    let totalPiutang = 0;
    for (const d of displayBerSpAktif) {
      for (const item of d.items) {
        if (item.qty > 0) totalPiutang += itemNetSubtotal(item, displayReturQtyMap[item.id] || 0);
      }
    }
    totalPiutang = money(totalPiutang);

    const displayInvoiced = invoiced.filter(row => row.sale?.display_source_id);
    const totalTerjualDisplay = money(displayInvoiced.reduce((sum, row) => sum + row.net, 0));
    const totalDisplayBelumLunas = money(displayInvoiced.reduce((sum, row) => sum + row.due, 0));

    const summary = { totalOmzet, totalBelumLunas, totalPiutang, totalTerjualDisplay, totalDisplayBelumLunas };

    // ── List data sesuai tab ──────────────────────────────────────────────────

    if (tab === 'penjualan') {
      const filtered = invoiced.filter(row => !search || [row.sale?.nama_penerima, row.sale?.no_po].join(' ').toLowerCase().includes(String(search).toLowerCase()));
      const list = filtered.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || b.id - a.id).slice(offset, offset + limitInt).map(row => ({
        id: row.id, tanggal: row.tanggal, nama_penerima: row.sale?.nama_penerima,
        faktur: row.sale?.faktur, status: row.sale?.status, from_display: !!row.sale?.display_source_id,
        belumLunas: row.due > 0, lunas: row.due === 0, progressLabel: row.due === 0 ? 'Lunas / Selesai' : 'Invoice Dibuat',
        progressLevel: row.due === 0 ? 100 : 75, total: row.net, total_tagihan: row.gross, ppn: row.tax, sisa: row.due,
      }));
      return res.json({ summary, list, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limitInt)), page: pageInt });
    }

    // tab === 'display'
    const whereDisplay = { tipe: 'DISPLAY', is_test: isTest };
    if (String(search).trim()) {
      const like = '%' + String(search).trim() + '%';
      const matchingSps = await SuratPengantar.findAll({ where: { nomor_sp: { [Op.like]: like } }, attributes: ['penjualan_offline_id'], raw: true });
      whereDisplay[Op.or] = [
        { nama_penerima: { [Op.like]: like } },
        { id: { [Op.in]: matchingSps.map(sp => sp.penjualan_offline_id) } },
      ];
    }
    const { count, rows } = await PenjualanOffline.findAndCountAll({
      where: whereDisplay,
      include: [
        { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal', 'barang_id', 'varian_nama'] },
        {
          model: SuratPengantar,
          as: 'suratPengantars',
          attributes: ['id', 'nomor_sp', 'tanggal'],
          required: true,
          ...(from || to ? { where: { tanggal: dateWhere } } : {}),
        },
      ],
      order: [[{ model: SuratPengantar, as: 'suratPengantars' }, 'tanggal', 'DESC'], ['created_at', 'DESC']],
      limit: limitInt,
      offset,
      distinct: true,
    });

    const displayIds = rows.map(d => d.id);
    // Hitung total yang sudah terjual per display
    const terjualPerDisplay = await PenjualanOffline.findAll({
      where: { display_source_id: { [Op.in]: displayIds.length ? displayIds : [0] }, is_test: isTest },
      include: [
        { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal', 'barang_id'] },
        { model: PembayaranOffline, as: 'pembayarans', attributes: ['jumlah'] },
        { model: Invoice, as: 'invoices', attributes: ['id', 'tanggal', 'ppn_persen'] },
      ],
      attributes: ['id', 'display_source_id', 'status'],
    });
    const allDisplayListItemIds = [
      ...rows.flatMap(d => (d.items || []).map(item => item.id)),
      ...terjualPerDisplay.flatMap(p => (p.items || []).map(item => item.id)),
    ];
    const returQtyMap = await getReturQtyMap(allDisplayListItemIds);
    const terjualMap = {};
    const terjualBelumLunasMap = {};
    const displayInvoiceMap = new Map(invoiceProjects(invoiceData, { source: 'OFFLINE', to }).map(row => [row.id, row]));
    for (const p of terjualPerDisplay) {
      const srcId = p.display_source_id;
      const recognized = displayInvoiceMap.get(p.id);
      const totalPenjualan = recognized?.net || 0;
      const sisaTagihan = recognized?.due || 0;
      terjualMap[srcId] = (terjualMap[srcId] || 0) + totalPenjualan;
      terjualBelumLunasMap[srcId] = (terjualBelumLunasMap[srcId] || 0) + sisaTagihan;
    }

    const list = rows.map(d => {
      const nilaiSisa = d.status === 'COMPLETED'
        ? 0
        : d.items
          .filter(i => i.qty > 0)
          .reduce((s, i) => s + itemNetSubtotal(i, returQtyMap[i.id] || 0), 0);
      const nilaiTerjual = terjualMap[d.id] || 0;
      const nilaiTerjualBelumLunas = terjualBelumLunasMap[d.id] || 0;
      const nilaiSisaM = money(nilaiSisa);
      const nilaiTerjualBelumLunasM = money(nilaiTerjualBelumLunas);
      const statusEfektif = (nilaiSisaM <= 0 && nilaiTerjualBelumLunasM <= 0) ? 'COMPLETED' : 'ACTIVE';
      return {
        id: d.id,
        tanggal: d.tanggal,
        nomor_sp: d.suratPengantars?.[0]?.nomor_sp || null,
        tanggal_sp: d.suratPengantars?.[0]?.tanggal || null,
        nama_penerima: d.nama_penerima,
        status: statusEfektif,
        status_asli: d.status,
        status_reason: statusEfektif === 'COMPLETED'
          ? 'Tidak ada sisa display beredar dan tidak ada tagihan display belum lunas'
          : nilaiSisaM > 0 ? 'Masih ada sisa display beredar' : 'Display sudah habis, tetapi tagihan display belum lunas',
        nilaiSisa: nilaiSisaM,
        nilaiTerjual: money(nilaiTerjual),
        nilaiTerjualBelumLunas: nilaiTerjualBelumLunasM,
        nilaiTotal: money(nilaiSisa + nilaiTerjual),
        adaSisa: nilaiSisaM > 0,
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
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const { from, to, page = 1, limit = 20 } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1), limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const data = await invoiceBasis.load({ source: 'INTERIOR', isTest: req.user.role === 'TEST' ? 1 : 0, to });
    const rows = invoiceProjects(data, { source: 'INTERIOR', from, to }).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || b.id - a.id);
    const summary = rows.reduce((sum, row) => ({ totalNilaiProyek: sum.totalNilaiProyek + row.net, totalTerbayar: sum.totalTerbayar + row.paid, totalOutstanding: sum.totalOutstanding + row.due }), { totalNilaiProyek: 0, totalTerbayar: 0, totalOutstanding: 0 });
    const list = rows.slice((pageInt - 1) * limitInt, pageInt * limitInt).map(row => ({
      id: row.id, tanggal: row.tanggal, no_po: row.sale?.no_po, nama_customer: row.sale?.nama_customer,
      status: row.sale?.status, faktur: row.sale?.faktur, pakai_ppn: row.sale?.pakai_ppn, ppn_persen: row.sale?.ppn_persen,
      grandTotal: row.net, total_tagihan: row.gross, ppn: row.tax, terbayar: row.paid, sisa: row.due,
      persen: row.gross > 0 ? Math.min(100, Math.round(row.paid / row.gross * 100)) : 0,
      lunas: row.due === 0 && row.gross > 0, pembayarans: row.pembayarans,
    }));
    return res.json({ summary, list, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limitInt)), page: pageInt });
  } catch (err) { return res.status(500).json({ message: 'Server error', error: err.message }); }
});

// GET /api/keuangan/online
router.get('/online', authenticate, async (req, res) => {
  try {
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const { from, to, page = 1, limit = 20 } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1), limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const data = await invoiceBasis.load({ source: 'ONLINE', isTest: req.user.role === 'TEST' ? 1 : 0, to });
    const rows = invoiceProjects(data, { source: 'ONLINE', from, to }).map(row => ({
      id: row.id, tanggal: row.tanggal, id_pesanan: row.sale?.id_pesanan, nama_pelanggan: row.sale?.nama_pelanggan,
      channel: row.sale?.channel, status: row.sale?.status, total_awal: row.net + row.returned,
      total_retur: row.returned, total: row.net, sisa: row.due, terbayar: row.paid,
      pendapatan_bersih: row.sale?.pendapatan_bersih == null ? null : money(row.sale.pendapatan_bersih),
      selisih: row.sale?.pendapatan_bersih == null ? null : money(row.net - Number(row.sale.pendapatan_bersih)),
    })).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || b.id - a.id);
    const summary = rows.reduce((sum, row) => {
      sum.totalNilaiAwal += row.total_awal; sum.totalRetur += row.total_retur; sum.totalNilai += row.total;
      if (row.total_retur > 0) sum.jumlahTransaksiRetur++;
      if (row.pendapatan_bersih !== null) { sum.totalNilaiSelesai += row.total; sum.totalPendapatanBersih += row.pendapatan_bersih; }
      if (row.status === 'SELESAI' && row.pendapatan_bersih === null) sum.menungguPendapatan++;
      return sum;
    }, { totalNilaiAwal: 0, totalRetur: 0, jumlahTransaksiRetur: 0, totalNilai: 0, totalNilaiSelesai: 0, totalPendapatanBersih: 0, totalSelisih: 0, menungguPendapatan: 0 });
    summary.totalSelisih = money(summary.totalNilaiSelesai - summary.totalPendapatanBersih);
    return res.json({ summary, list: rows.slice((pageInt - 1) * limitInt, pageInt * limitInt), total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limitInt)), page: pageInt });
  } catch (err) { return res.status(500).json({ message: 'Server error', error: err.message }); }
});

module.exports = router;
