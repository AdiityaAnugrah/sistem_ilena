const express = require('express');
const { Op } = require('sequelize');
const {
  ChartOfAccount,
  PenjualanOnline, PenjualanOnlineItem, InvoiceOnline, PembayaranOnline, ReturOnline,
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, Invoice, ReturOffline,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior, InvoiceInterior, ProformaInvoice,
  SuratJalanInterior, SuratJalanInteriorItem, ReturSJInterior,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const { buildOnlineJournal } = require('../utils/onlineJournal');
const { createInteriorFinance } = require('../utils/interiorFinance');
const { buildEffectiveInteriorInvoices } = require('../utils/interiorReceivables');
const { selectLatestBySale } = require('../utils/financialDocuments');
const { invoiceInteriorAmount, buildInteriorAdvanceState } = createInteriorFinance({ SuratJalanInterior, SuratJalanInteriorItem, PenjualanInteriorItem });
const { interiorItemAmounts } = require('../utils/interiorVat');

const router = express.Router();
const money = (v) => Math.round(Number(v || 0));

const DEFAULT_COA = [
  { code: '1101', name: 'Kas Tunai', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan pembayaran tunai' },
  { code: '1102', name: 'Bank / Transfer', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui transfer bank' },
  { code: '1103', name: 'QRIS', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui QRIS' },
  { code: '1104', name: 'EDC / Kartu', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui mesin EDC' },
  { code: '1105', name: 'Marketplace', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan melalui marketplace' },
  { code: '1109', name: 'Kas/Bank Lainnya', type: 'ASET', normal_balance: 'DEBIT', description: 'Penerimaan metode lainnya' },
  { code: '1106', name: 'Dana Marketplace / Gateway', type: 'ASET', normal_balance: 'DEBIT', description: 'Pembayaran customer online, belum dianggap pencairan bank' },
  { code: '1201', name: 'Piutang Usaha', type: 'ASET', normal_balance: 'DEBIT', description: 'Tagihan penjualan kepada customer' },
  { code: '2102', name: 'Uang Muka Customer', type: 'KEWAJIBAN', normal_balance: 'KREDIT', description: 'Pembayaran customer yang belum dipakai untuk tagihan' },
  { code: '2101', name: 'PPN Keluaran', type: 'KEWAJIBAN', normal_balance: 'KREDIT', description: 'PPN yang dipungut dari customer' },
  { code: '4101', name: 'Penjualan Offline', type: 'PENDAPATAN', normal_balance: 'KREDIT', description: 'Pendapatan penjualan offline/toko' },
  { code: '4102', name: 'Penjualan Interior', type: 'PENDAPATAN', normal_balance: 'KREDIT', description: 'Pendapatan proyek interior' },
  { code: '4103', name: 'Penjualan Online', type: 'PENDAPATAN', normal_balance: 'KREDIT', description: 'Nilai invoice penjualan online' },
  { code: '4203', name: 'Retur Penjualan Online', type: 'PENDAPATAN', normal_balance: 'DEBIT', description: 'Pengembalian dana penjualan online' },
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

const offlineReturValue = (retur) => {
  const item = retur.item;
  if (!item || !item.qty) return 0;
  return money((Number(item.subtotal || 0) / Number(item.qty || 1)) * Number(retur.qty_retur || 0));
};

const latestOfflinePpn = (penjualan) => {
  const invoices = penjualan?.invoices || [];
  if (!invoices.length) return 0;
  return Number(invoices[invoices.length - 1]?.ppn_persen || 0);
};

const offlineReturAmount = (retur) => {
  const subtotal = offlineReturValue(retur);
  const ppn = money(subtotal * latestOfflinePpn(retur.penjualan) / 100);
  return { subtotal, ppn, total: money(subtotal + ppn) };
};

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
    if (to) dateWhere[Op.lte] = to;

    const rows = [];
    const push = (trx) => rows.push({
      total_debit: trx.lines.reduce((s, l) => s + l.debit, 0),
      total_kredit: trx.lines.reduce((s, l) => s + l.kredit, 0),
      balanced: trx.lines.reduce((s, l) => s + l.debit, 0) === trx.lines.reduce((s, l) => s + l.kredit, 0),
      ...trx,
    });

    const find = (source, model, options) => !sumber || sumber === source ? model.findAll(options) : Promise.resolve([]);
    const invoiceWhere = Object.keys(dateWhere).length ? { tanggal: dateWhere } : {};
    const [offlineInvoices, offlinePayments, offlineReturs, interiorInvoices, interiorPayments, interiorReturs, interiorSubInvoices, onlineInvoices, onlinePayments, onlineReturs] = await Promise.all([
      find('OFFLINE', Invoice, {
        where: invoiceWhere,
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest }, include: [
          { model: PenjualanOfflineItem, as: 'items' },
          { model: ReturOffline, as: 'returs' },
        ] }],
      }),
      find('OFFLINE', PembayaranOffline, {
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest } }],
      }),
      find('OFFLINE', ReturOffline, {
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: Invoice, as: 'invoices' }] }, { model: PenjualanOfflineItem, as: 'item' }],
      }),
      find('INTERIOR', InvoiceInterior, {
        where: invoiceWhere,
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
      find('INTERIOR', PembayaranInterior, {
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }],
      }),
      find('INTERIOR', ReturSJInterior, {
        where: Object.keys(dateWhere).length ? { tanggal: dateWhere } : {},
        include: [{ model: PenjualanInteriorItem, as: 'item', include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }] }],
      }),
      find('INTERIOR', ProformaInvoice, {
        where: { ...invoiceWhere, nomor_sub_invoice: { [Op.ne]: null } },
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
      find('ONLINE', InvoiceOnline, {
        where: invoiceWhere,
        include: [{ model: PenjualanOnline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanOnlineItem, as: 'items' }] }],
      }),
      find('ONLINE', PembayaranOnline, {
        where: invoiceWhere,
        include: [{ model: PenjualanOnline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanOnlineItem, as: 'items' }] }],
      }),
      find('ONLINE', ReturOnline, {
        where: { ...invoiceWhere, tipe: 'PENGEMBALIAN_DANA' },
        include: [{ model: PenjualanOnline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanOnlineItem, as: 'items' }] }],
      }),
    ]);

    for (const inv of selectLatestBySale(offlineInvoices, 'penjualan_offline_id', to)) {
      const subtotal = money((inv.penjualan?.items || []).reduce((s, item) => s + Number(item.subtotal || 0), 0));
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
      const amount = offlineReturAmount(r);
      if (amount.total <= 0) continue;
      push({
        id: `OFFLINE-RETUR-${r.id}`,
        tanggal: r.tanggal,
        sumber: 'OFFLINE',
        jenis: 'RETUR',
        referensi: `Retur #${r.id}`,
        customer: r.penjualan?.nama_penerima,
        no_po: r.penjualan?.no_po,
        nilai: amount.total,
        keterangan: r.catatan || 'Retur penjualan offline',
        detail_url: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
        lines: [line('4201', amount.subtotal, 0), ...(amount.ppn > 0 ? [line('2101', amount.ppn, 0)] : []), line('1201', 0, amount.total)],
      });
    }

    const effectiveInteriorInvoices = await buildEffectiveInteriorInvoices(interiorInvoices, interiorSubInvoices, invoiceInteriorAmount);
    const advanceState = await buildInteriorAdvanceState(effectiveInteriorInvoices, interiorPayments);
    for (const inv of effectiveInteriorInvoices) {
      const amount = await invoiceInteriorAmount(inv);
      if (amount.total <= 0) continue;
      push({
        id: `INTERIOR-INVOICE-${inv.ledgerKey ?? inv.id}`,
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
      const normal = advanceState.normalPaymentAmounts.get(Number(p.id)) || 0;
      const advance = amount - normal;
      push({
        id: `INTERIOR-PEMBAYARAN-${p.id}`, tanggal: p.tanggal, sumber: 'INTERIOR', jenis: 'PEMBAYARAN', referensi: p.tipe,
        customer: p.penjualan?.nama_customer, no_po: p.penjualan?.no_po, nilai: amount,
        keterangan: p.catatan || 'Pembayaran interior',
        bukti_endpoint: p.bukti_bayar ? `/penjualan-interior/${p.penjualan_interior_id}/pembayaran/${p.id}/bukti` : null,
        detail_url: `/dashboard/penjualan/interior/${p.penjualan_interior_id}`,
        lines: [line('1102', amount, 0), ...(normal > 0 ? [line('1201', 0, normal)] : []), ...(advance > 0 ? [line('2102', 0, advance)] : [])],
      });
    }
    for (const event of advanceState.history.filter(e => e.terpakai > 0)) {
      push({
        id: event.id, tanggal: event.tanggal, sumber: 'INTERIOR', jenis: 'UANG_MUKA_TERPAKAI', referensi: event.referensi,
        customer: event.nama_customer, no_po: event.no_po, nilai: event.terpakai,
        keterangan: event.keterangan, detail_url: event.detail_url,
        lines: [line('2102', event.terpakai, 0), line('1201', 0, event.terpakai)],
      });
    }

    for (const r of interiorReturs) {
      const baseItem = r.item;
      const penjualan = baseItem?.penjualan;
      const amount = interiorItemAmounts(baseItem, penjualan, r.qty_retur);
      const subtotal = money(amount.subtotal);
      const total = money(amount.total);
      const ppn = total - subtotal;
      if (total <= 0) continue;
      push({
        id: `INTERIOR-RETUR-${r.id}`,
        tanggal: r.tanggal,
        sumber: 'INTERIOR',
        jenis: 'RETUR',
        referensi: `Retur SJ #${r.surat_jalan_interior_id}`,
        customer: penjualan?.nama_customer,
        no_po: penjualan?.no_po,
        nilai: total,
        keterangan: r.catatan || 'Retur penjualan interior',
        detail_url: `/dashboard/penjualan/interior/${baseItem?.penjualan_interior_id}`,
        lines: [line('4202', subtotal, 0), ...(ppn > 0 ? [line('2101', ppn, 0)] : []), line('1201', 0, total)],
      });
    }

    for (const entry of buildOnlineJournal(onlineInvoices, onlinePayments, onlineReturs, line)) push(entry);

    const filtered = rows.filter(trx => (!from || trx.tanggal >= from) && (!to || trx.tanggal <= to) && matches(trx, { sumber, jenis, search }))
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal) || String(b.id).localeCompare(String(a.id)));

    const summary = filtered.reduce((acc, trx) => {
      acc.totalDebit += trx.total_debit;
      acc.totalKredit += trx.total_kredit;
      if (trx.jenis === 'INVOICE') acc.totalInvoice += trx.nilai;
      if (trx.jenis === 'PEMBAYARAN') acc.totalPembayaran += trx.nilai;
      if (trx.jenis === 'RETUR') acc.totalRetur += trx.nilai;
      return acc;
    }, { totalDebit: 0, totalKredit: 0, totalInvoice: 0, totalPembayaran: 0, totalRetur: 0 });
    summary.totalUangMukaTerpakai = filtered.filter(trx => trx.jenis === 'UANG_MUKA_TERPAKAI').reduce((sum, trx) => sum + trx.nilai, 0);
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
