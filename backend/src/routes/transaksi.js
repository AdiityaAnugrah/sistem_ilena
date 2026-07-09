const express = require('express');
const { Op } = require('sequelize');
const {
  ChartOfAccount,
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, Invoice, ReturOffline,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior, InvoiceInterior,
  SuratJalanInterior, SuratJalanInteriorItem, ReturSJInterior,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const money = (v) => Math.round(Number(v || 0));

const DEFAULT_COA = [
  { code: '1101', name: 'Kas Tunai', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan pembayaran tunai' },
  { code: '1102', name: 'Bank / Transfer', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui transfer bank' },
  { code: '1103', name: 'QRIS', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui QRIS' },
  { code: '1104', name: 'EDC / Kartu', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui mesin EDC' },
  { code: '1105', name: 'Marketplace', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui marketplace' },
  { code: '1109', name: 'Kas/Bank Lainnya', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan metode lainnya' },
  { code: '1201', name: 'Piutang Usaha', type: 'ASET', normal_balance: 'DEBIT', description: 'Tagihan penjualan kepada customer' },
  { code: '2101', name: 'PPN Keluaran', type: 'KEWAJIBAN', normal_balance: 'KREDIT', description: 'PPN yang dipungut dari customer' },
  { code: '4101', name: 'Penjualan Offline', type: 'PENDAPATAN', normal_balance: 'KREDIT', description: 'Pendapatan penjualan offline/toko' },
  { code: '4102', name: 'Penjualan Interior', type: 'PENDAPATAN', normal_balance: 'KREDIT', description: 'Pendapatan proyek interior' },
  { code: '4201', name: 'Retur Penjualan Offline', type: 'PENDAPATAN', normal_balance: 'DEBIT', description: 'Pengurang pendapatan/piutang offline' },
  { code: '4202', name: 'Retur Penjualan Interior', type: 'PENDAPATAN', normal_balance: 'DEBIT', description: 'Pengurang pendapatan/piutang interior' },
];

async function ensureDefaultCoa() {
  for (const row of DEFAULT_COA) {
    await ChartOfAccount.findOrCreate({ where: { code: row.code }, defaults: row });
  }
}

const coaMap = Object.fromEntries(DEFAULT_COA.map(c => [c.code, c]));
const line = (code, debit = 0, kredit = 0) => ({
  account_code: code,
  account_name: coaMap[code]?.name || code,
  account_type: coaMap[code]?.type || '-',
  debit: money(debit),
  kredit: money(kredit),
});

const methodAccount = (metode) => ({
  TRANSFER: '1102',
  TUNAI: '1101',
  QRIS: '1103',
  EDC: '1104',
  MARKETPLACE: '1105',
  LAINNYA: '1109',
}[metode] || '1109');

const itemNetSubtotal = (item, returQty = 0) => {
  const qty = Number(item.qty || 0);
  const subtotal = Number(item.subtotal || 0);
  if (qty <= 0) return money(subtotal);
  return money(Math.max(0, subtotal - ((subtotal / qty) * Number(returQty || 0))));
};

const offlineNetTotal = (penjualan) => {
  const returs = penjualan.returs || [];
  const returByItem = {};
  returs.forEach(r => {
    const itemId = Number(r.penjualan_offline_item_id);
    returByItem[itemId] = (returByItem[itemId] || 0) + Number(r.qty_retur || 0);
  });
  return money((penjualan.items || []).reduce((s, item) => s + itemNetSubtotal(item, returByItem[item.id] || 0), 0));
};

const offlineReturValue = (retur) => {
  const item = retur.item;
  if (!item || !item.qty) return 0;
  return money((Number(item.subtotal || 0) / Number(item.qty || 1)) * Number(retur.qty_retur || 0));
};

const interiorTotal = (penjualan) => {
  const subtotal = (penjualan.items || []).reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const ppn = penjualan.pakai_ppn ? subtotal * (Number(penjualan.ppn_persen || 0) / 100) : 0;
  return { subtotal: money(subtotal), ppn: money(ppn), total: money(subtotal + ppn) };
};

async function invoiceInteriorAmount(inv) {
  let ids = [];
  if (inv.surat_jalan_ids) {
    try { ids = JSON.parse(inv.surat_jalan_ids).map(Number).filter(Boolean); } catch { ids = []; }
  } else if (inv.surat_jalan_interior_id) {
    ids = [Number(inv.surat_jalan_interior_id)];
  }

  let subtotal = 0;
  if (ids.length > 0) {
    const sjs = await SuratJalanInterior.findAll({
      where: { id: { [Op.in]: ids } },
      include: [{ model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] }],
    });
    for (const sj of sjs) {
      for (const sjItem of (sj.items || [])) {
        const baseItem = sjItem.item;
        const unit = baseItem?.qty ? Number(baseItem.subtotal || 0) / Number(baseItem.qty) : 0;
        subtotal += unit * Number(sjItem.qty_kirim || 0);
      }
    }
  } else {
    subtotal = (inv.penjualan?.items || []).reduce((s, i) => s + Number(i.subtotal || 0), 0);
  }
  const ppn = inv.penjualan?.pakai_ppn ? subtotal * (Number(inv.penjualan.ppn_persen || 0) / 100) : 0;
  return { subtotal: money(subtotal), ppn: money(ppn), total: money(subtotal + ppn) };
}

const matches = (trx, { sumber, jenis, search }) => {
  if (sumber && trx.sumber !== sumber) return false;
  if (jenis && trx.jenis !== jenis) return false;
  if (search) {
    const q = String(search).toLowerCase();
    const text = [trx.referensi, trx.customer, trx.no_po, trx.keterangan].filter(Boolean).join(' ').toLowerCase();
    if (!text.includes(q)) return false;
  }
  return true;
};

router.get('/coa', authenticate, async (req, res) => {
  await ensureDefaultCoa();
  const rows = await ChartOfAccount.findAll({ where: { active: 1 }, order: [['code', 'ASC']] });
  res.json(rows);
});

// GET /api/transaksi
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureDefaultCoa();
    const { from, to, sumber, jenis, search, page = 1, limit = 25 } = req.query;
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const dateWhere = {};
    if (from) dateWhere[Op.gte] = from;
    if (to) dateWhere[Op.lte] = to;

    const rows = [];
    const push = (trx) => rows.push({
      total_debit: trx.lines.reduce((s, l) => s + l.debit, 0),
      total_kredit: trx.lines.reduce((s, l) => s + l.kredit, 0),
      balanced: trx.lines.reduce((s, l) => s + l.debit, 0) === trx.lines.reduce((s, l) => s + l.kredit, 0),
      ...trx,
    });

    const invoiceWhere = Object.keys(dateWhere).length ? { tanggal: dateWhere } : {};
    const [offlineInvoices, offlinePayments, offlineReturs, interiorInvoices, interiorPayments, interiorReturs] = await Promise.all([
      Invoice.findAll({
        where: invoiceWhere,
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest }, include: [
          { model: PenjualanOfflineItem, as: 'items' },
          { model: ReturOffline, as: 'returs' },
        ] }],
      }),
      PembayaranOffline.findAll({
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest } }],
      }),
      ReturOffline.findAll({
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest } }, { model: PenjualanOfflineItem, as: 'item' }],
      }),
      InvoiceInterior.findAll({
        where: invoiceWhere,
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
      PembayaranInterior.findAll({
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }],
      }),
      ReturSJInterior.findAll({
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanInteriorItem, as: 'item', include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }] }],
      }),
    ]);

    for (const inv of offlineInvoices) {
      const subtotal = offlineNetTotal(inv.penjualan);
      const ppn = money(subtotal * Number(inv.ppn_persen || 0) / 100);
      const total = money(subtotal + ppn);
      if (total <= 0) continue;
      push({
        id: `OFFLINE-INVOICE-${inv.id}`,
        tanggal: inv.tanggal,
        sumber: 'OFFLINE',
        jenis: 'INVOICE',
        referensi: inv.nomor_invoice,
        customer: inv.penjualan?.nama_penerima,
        no_po: inv.penjualan?.no_po,
        nilai: total,
        keterangan: 'Invoice penjualan offline',
        detail_url: `/dashboard/penjualan/offline/${inv.penjualan_offline_id}`,
        lines: [line('1201', total, 0), line('4101', 0, subtotal), ...(ppn > 0 ? [line('2101', 0, ppn)] : [])],
      });
    }

    for (const p of offlinePayments) {
      const amount = money(p.jumlah);
      push({
        id: `OFFLINE-PEMBAYARAN-${p.id}`,
        tanggal: p.tanggal,
        sumber: 'OFFLINE',
        jenis: 'PEMBAYARAN',
        referensi: p.metode,
        customer: p.penjualan?.nama_penerima,
        no_po: p.penjualan?.no_po,
        nilai: amount,
        keterangan: p.catatan || 'Pembayaran offline',
        bukti_endpoint: p.bukti_bayar ? `/penjualan-offline/${p.penjualan_offline_id}/pembayaran/${p.id}/bukti` : null,
        detail_url: `/dashboard/penjualan/offline/${p.penjualan_offline_id}`,
        lines: [line(methodAccount(p.metode), amount, 0), line('1201', 0, amount)],
      });
    }

    for (const r of offlineReturs) {
      const amount = offlineReturValue(r);
      if (amount <= 0) continue;
      push({
        id: `OFFLINE-RETUR-${r.id}`,
        tanggal: r.tanggal,
        sumber: 'OFFLINE',
        jenis: 'RETUR',
        referensi: `Retur #${r.id}`,
        customer: r.penjualan?.nama_penerima,
        no_po: r.penjualan?.no_po,
        nilai: amount,
        keterangan: r.catatan || 'Retur penjualan offline',
        detail_url: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
        lines: [line('4201', amount, 0), line('1201', 0, amount)],
      });
    }

    for (const inv of interiorInvoices) {
      const amount = await invoiceInteriorAmount(inv);
      if (amount.total <= 0) continue;
      push({
        id: `INTERIOR-INVOICE-${inv.id}`,
        tanggal: inv.tanggal,
        sumber: 'INTERIOR',
        jenis: 'INVOICE',
        referensi: inv.nomor_invoice,
        customer: inv.penjualan?.nama_customer,
        no_po: inv.penjualan?.no_po,
        nilai: amount.total,
        keterangan: 'Invoice penjualan interior',
        detail_url: `/dashboard/penjualan/interior/${inv.penjualan_interior_id}`,
        lines: [line('1201', amount.total, 0), line('4102', 0, amount.subtotal), ...(amount.ppn > 0 ? [line('2101', 0, amount.ppn)] : [])],
      });
    }

    for (const p of interiorPayments) {
      const amount = money(p.jumlah);
      push({
        id: `INTERIOR-PEMBAYARAN-${p.id}`,
        tanggal: p.tanggal,
        sumber: 'INTERIOR',
        jenis: 'PEMBAYARAN',
        referensi: p.tipe,
        customer: p.penjualan?.nama_customer,
        no_po: p.penjualan?.no_po,
        nilai: amount,
        keterangan: p.catatan || 'Pembayaran interior',
        bukti_endpoint: p.bukti_bayar ? `/penjualan-interior/${p.penjualan_interior_id}/pembayaran/${p.id}/bukti` : null,
        detail_url: `/dashboard/penjualan/interior/${p.penjualan_interior_id}`,
        lines: [line('1102', amount, 0), line('1201', 0, amount)],
      });
    }

    for (const r of interiorReturs) {
      const baseItem = r.item;
      const penjualan = baseItem?.penjualan;
      const unit = baseItem?.qty ? Number(baseItem.subtotal || 0) / Number(baseItem.qty) : 0;
      const amount = money(unit * Number(r.qty_retur || 0));
      if (amount <= 0) continue;
      push({
        id: `INTERIOR-RETUR-${r.id}`,
        tanggal: r.tanggal,
        sumber: 'INTERIOR',
        jenis: 'RETUR',
        referensi: `Retur SJ #${r.surat_jalan_interior_id}`,
        customer: penjualan?.nama_customer,
        no_po: penjualan?.no_po,
        nilai: amount,
        keterangan: r.catatan || 'Retur penjualan interior',
        detail_url: `/dashboard/penjualan/interior/${baseItem?.penjualan_interior_id}`,
        lines: [line('4202', amount, 0), line('1201', 0, amount)],
      });
    }

    const filtered = rows.filter(trx => matches(trx, { sumber, jenis, search }))
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal) || String(b.id).localeCompare(String(a.id)));

    const summary = filtered.reduce((acc, trx) => {
      acc.totalDebit += trx.total_debit;
      acc.totalKredit += trx.total_kredit;
      if (trx.jenis === 'INVOICE') acc.totalInvoice += trx.nilai;
      if (trx.jenis === 'PEMBAYARAN') acc.totalPembayaran += trx.nilai;
      if (trx.jenis === 'RETUR') acc.totalRetur += trx.nilai;
      return acc;
    }, { totalDebit: 0, totalKredit: 0, totalInvoice: 0, totalPembayaran: 0, totalRetur: 0 });
    summary.selisihInvoicePembayaran = Math.max(0, summary.totalInvoice - summary.totalPembayaran - summary.totalRetur);

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;

    res.json({
      data: filtered.slice(offset, offset + limitInt),
      summary,
      total: filtered.length,
      page: pageInt,
      totalPages: Math.ceil(filtered.length / limitInt),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
