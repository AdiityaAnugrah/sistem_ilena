const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, SuratJalan, Invoice, SuratPengantar,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  PenjualanOnline, PenjualanOnlineItem, ReturOnline,
  ReturOffline, ReturSJInterior,
  sequelize,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const money = (value) => Math.round(Number(value || 0));
const itemNetSubtotal = (item, returQty = 0) => {
  const qty = Number(item.qty || 0);
  const subtotal = Number(item.subtotal || 0);
  if (qty <= 0 || subtotal <= 0) return 0;
  const unitPrice = subtotal / qty;
  return Math.max(0, subtotal - (Number(returQty || 0) * unitPrice));
};
const sumItemsNetAfterRetur = (items = [], returQtyMap = {}) =>
  items.reduce((sum, item) => sum + itemNetSubtotal(item, returQtyMap[item.id] || 0), 0);
const sumPayments = (payments = []) => money(payments.reduce((sum, p) => sum + Number(p.jumlah || 0), 0));

const getInteriorReturQtyMap = async (itemIds = []) => {
  const ids = [...new Set(itemIds.filter(Boolean).map(Number))];
  if (ids.length === 0) return {};
  const rows = await ReturSJInterior.findAll({
    where: { penjualan_interior_item_id: { [Op.in]: ids } },
    attributes: [
      'penjualan_interior_item_id',
      [sequelize.fn('SUM', sequelize.col('qty_retur')), 'total_retur'],
    ],
    group: ['penjualan_interior_item_id'],
    raw: true,
  });
  return rows.reduce((map, row) => {
    map[row.penjualan_interior_item_id] = Number(row.total_retur || 0);
    return map;
  }, {});
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

const sumOfflineItemsNetByPenjualanWhere = async (penjualanWhere) => {
  const items = await PenjualanOfflineItem.findAll({
    include: [{
      model: PenjualanOffline, as: 'penjualan',
      where: penjualanWhere,
      attributes: [],
      required: true,
    }],
    attributes: ['id', 'qty', 'subtotal'],
  });
  const returQtyMap = await getReturQtyMap(items.map(i => i.id));
  return money(sumItemsNetAfterRetur(items, returQtyMap));
};

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

    // Total omzet penjualan langsung — NET setelah retur
    const totalOmzet = await sumOfflineItemsNetByPenjualanWhere({
      tipe: 'PENJUALAN',
      is_test: isTest,
      ...(from || to ? { tanggal: dateWhere } : {}),
    });

    // Total penjualan offline yang belum ditandai selesai/lunas — NET setelah retur
    const totalBelumLunas = await sumOfflineItemsNetByPenjualanWhere({
      tipe: 'PENJUALAN',
      status: { [Op.ne]: 'COMPLETED' },
      is_test: isTest,
      ...(from || to ? { tanggal: dateWhere } : {}),
    });

    // Piutang Display berasal dari DISPLAY yang sudah dibuat Surat Pengantar.
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

    // Total sudah terjual dari display — NET setelah retur
    const totalTerjualDisplay = await sumOfflineItemsNetByPenjualanWhere({
      tipe: 'PENJUALAN',
      is_test: isTest,
      display_source_id: { [Op.not]: null },
      ...(from || to ? { tanggal: dateWhere } : {}),
    });

    // Total display yang sudah laku tetapi belum selesai/lunas — NET setelah retur
    const totalDisplayBelumLunas = await sumOfflineItemsNetByPenjualanWhere({
      tipe: 'PENJUALAN',
      status: { [Op.ne]: 'COMPLETED' },
      is_test: isTest,
      display_source_id: { [Op.not]: null },
      ...(from || to ? { tanggal: dateWhere } : {}),
    });

    const summary = { totalOmzet, totalBelumLunas, totalPiutang, totalTerjualDisplay, totalDisplayBelumLunas };

    // ── List data sesuai tab ──────────────────────────────────────────────────

    if (tab === 'penjualan') {
      const where = { tipe: 'PENJUALAN', is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };
      const { count, rows } = await PenjualanOffline.findAndCountAll({
        where,
        include: [
          { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
          { model: SuratJalan, as: 'suratJalans', attributes: ['id'] },
          { model: Invoice, as: 'invoices', attributes: ['id'] },
        ],
        order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
        limit: limitInt,
        offset,
        distinct: true,
      });
      const returQtyMap = await getReturQtyMap(rows.flatMap(p => (p.items || []).map(item => item.id)));
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
          total: money(sumItemsNetAfterRetur(p.items, returQtyMap)),
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
    const whereDisplay = { tipe: 'DISPLAY', is_test: isTest };
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
    for (const p of terjualPerDisplay) {
      const srcId = p.display_source_id;
      const totalPenjualan = money(sumItemsNetAfterRetur(p.items || [], returQtyMap));
      const totalTerbayar = sumPayments(p.pembayarans || []);
      const sisaTagihan = Math.max(0, totalPenjualan - totalTerbayar);
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
        { model: PenjualanInteriorItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        { model: PembayaranInterior, as: 'pembayarans', attributes: ['jumlah'] },
      ],
      attributes: ['id', 'pakai_ppn', 'ppn_persen'],
    });

    const interiorReturQtyMap = await getInteriorReturQtyMap(
      allProyek.flatMap(p => (p.items || []).map(item => item.id))
    );
    let totalNilaiProyek = 0, totalTerbayar = 0;
    for (const p of allProyek) {
      const subtotal = sumItemsNetAfterRetur(p.items, interiorReturQtyMap);
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
        { model: PenjualanInteriorItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        { model: PembayaranInterior, as: 'pembayarans', attributes: ['jumlah', 'tipe', 'tanggal'] },
      ],
      order: [['tanggal', 'DESC'], ['created_at', 'DESC']],
      limit: limitInt,
      offset,
      distinct: true,
    });
    const listReturQtyMap = await getInteriorReturQtyMap(
      rows.flatMap(p => (p.items || []).map(item => item.id))
    );

    const list = rows.map(p => {
      const subtotal = sumItemsNetAfterRetur(p.items, listReturQtyMap);
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

// GET /api/keuangan/online
router.get('/online', authenticate, async (req, res) => {
  try {
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const { from, to, page = 1, limit = 20 } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const dateWhere = {};
    if (from) dateWhere[Op.gte] = from;
    if (to) dateWhere[Op.lte] = to;
    const where = { is_test: isTest, ...(from || to ? { tanggal: dateWhere } : {}) };

    const attachFinancials = async (sales) => {
      const ids = sales.map(sale => Number(sale.id));
      if (ids.length === 0) return [];
      const [items, returs] = await Promise.all([
        PenjualanOnlineItem.findAll({ where: { penjualan_online_id: { [Op.in]: ids } }, attributes: ['id', 'penjualan_online_id', 'qty', 'subtotal'] }),
        ReturOnline.findAll({ where: { penjualan_online_id: { [Op.in]: ids }, tipe: 'PENGEMBALIAN_DANA' }, attributes: ['penjualan_online_id', 'jumlah_refund'] }),
      ]);
      const returMap = returs.reduce((map, retur) => {
        const saleId = Number(retur.penjualan_online_id);
        map[saleId] = (map[saleId] || 0) + Number(retur.jumlah_refund || 0);
        return map;
      }, {});
      const itemMap = items.reduce((map, item) => {
        const key = Number(item.penjualan_online_id);
        if (!map[key]) map[key] = [];
        map[key].push(item);
        return map;
      }, {});
      return sales.map(sale => {
        const saleId = Number(sale.id);
        const subtotal = sumItemsNetAfterRetur(itemMap[saleId] || [], {});
        const totalAwal = money(Math.max(0, subtotal + Number(sale.ongkir || 0) + Number(sale.biaya_lain || 0) - Number(sale.diskon_order || 0)));
        const totalRetur = money(returMap[saleId] || 0);
        const total = money(Math.max(0, totalAwal - totalRetur));
        const pendapatanBersih = sale.pendapatan_bersih === null ? null : money(sale.pendapatan_bersih);
        return {
          id: sale.id, id_pesanan: sale.id_pesanan, nama_pelanggan: sale.nama_pelanggan,
          channel: sale.channel, tanggal: sale.tanggal, status: sale.status,
          total_awal: totalAwal, total_retur: totalRetur, total, pendapatan_bersih: pendapatanBersih,
          selisih: pendapatanBersih === null ? null : money(total - pendapatanBersih),
        };
      });
    };

    const [allSales, paged] = await Promise.all([
      PenjualanOnline.findAll({ where, attributes: ['id', 'id_pesanan', 'nama_pelanggan', 'channel', 'tanggal', 'status', 'ongkir', 'biaya_lain', 'diskon_order', 'pendapatan_bersih'] }),
      PenjualanOnline.findAndCountAll({ where, attributes: ['id', 'id_pesanan', 'nama_pelanggan', 'channel', 'tanggal', 'status', 'ongkir', 'biaya_lain', 'diskon_order', 'pendapatan_bersih'], order: [['tanggal', 'DESC'], ['created_at', 'DESC']], limit: limitInt, offset: (pageInt - 1) * limitInt }),
    ]);
    const [allRows, list] = await Promise.all([attachFinancials(allSales), attachFinancials(paged.rows)]);
    const summary = allRows.reduce((acc, row) => {
      acc.totalNilaiAwal += row.total_awal;
      acc.totalRetur += row.total_retur;
      acc.totalNilai += row.total;
      if (row.pendapatan_bersih !== null) {
        acc.totalNilaiSelesai += row.total;
        acc.totalPendapatanBersih += row.pendapatan_bersih;
      }
      if (row.status === 'SELESAI' && row.pendapatan_bersih === null) acc.menungguPendapatan += 1;
      return acc;
    }, { totalNilaiAwal: 0, totalRetur: 0, totalNilai: 0, totalNilaiSelesai: 0, totalPendapatanBersih: 0, menungguPendapatan: 0 });
    summary.totalSelisih = money(summary.totalNilaiSelesai - summary.totalPendapatanBersih);
    return res.json({ summary, list, total: paged.count, totalPages: Math.ceil(paged.count / limitInt), page: pageInt });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
