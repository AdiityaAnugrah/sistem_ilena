const express = require('express');
const { ChartOfAccount } = require('../models');
const { financeDateRangeError } = require('../utils/financeDateRange');
const { authenticate } = require('../middleware/auth');

const { createInvoiceBasis } = require('../utils/invoiceBasis');
const invoiceBasis = createInvoiceBasis(require('../models'));
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
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    await ensureDefaultCoa();
    const { from, to, sumber, jenis, search, page = 1, limit = 25 } = req.query;
    const isTest = req.user.role === 'TEST' ? 1 : 0;

    const rows = [];
    const push = (trx) => rows.push({
      total_debit: trx.lines.reduce((s, l) => s + l.debit, 0),
      total_kredit: trx.lines.reduce((s, l) => s + l.kredit, 0),
      balanced: trx.lines.reduce((s, l) => s + l.debit, 0) === trx.lines.reduce((s, l) => s + l.kredit, 0),
      ...trx,
    });

    const data = await invoiceBasis.load({ source: sumber || '', isTest, to });
    for (const entry of data.journal) push({ ...entry, sale: undefined, raw: undefined,
      lines: entry.lines.map(row => line(row.account_code, row.debit, row.kredit)),
    });

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
