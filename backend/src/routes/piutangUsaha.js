const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior, InvoiceInterior, ProformaInvoice,
  SuratJalanInterior, SuratJalanInteriorItem,
} = require('../models');
const { financeDateRangeError } = require('../utils/financeDateRange');
const { authenticate } = require('../middleware/auth');

const { buildEffectiveInteriorInvoices } = require('../utils/interiorReceivables');


const { createInvoiceBasis } = require('../utils/invoiceBasis');
const invoiceBasis = createInvoiceBasis(require('../models'));
const router = express.Router();
const money = (v) => Math.round(Number(v || 0));

const customerKey = (name) => String(name || 'Tanpa Nama').trim().toLowerCase().replace(/\s+/g, ' ');

const itemSubtotal = (item) => money(Number(item?.subtotal || 0));
const { createInteriorFinance } = require('../utils/interiorFinance');
const { prepareInvoiceAmounts, buildInteriorAdvanceState } = createInteriorFinance({ SuratJalanInterior, SuratJalanInteriorItem, PenjualanInteriorItem });

function inPeriod(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function entryMatches(entry, { search, customer_key, sumber, faktur }) {
  if (sumber && entry.sumber !== sumber) return false;
  if (faktur && entry.faktur !== faktur) return false;
  if (customer_key && entry.piutang_key !== customer_key && entry.customer_key !== customer_key) return false;
  if (search) {
    const q = String(search).toLowerCase();
    const text = [
      entry.customer,
      entry.no_po,
      entry.keterangan,
      entry.referensi,
      entry.sumber,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!text.includes(q)) return false;
  }
  return true;
}

function filterLedgerBySearch(entries, search) {
  if (!search) return entries;
  const matchedKeys = new Set(entries
    .filter(entry => entryMatches(entry, { search }))
    .map(entry => entry.piutang_key));
  return entries.filter(entry => matchedKeys.has(entry.piutang_key));
}

const { selectLatestBySale } = require('../utils/financialDocuments');
const selectLatestOfflineInvoices = (rows, to) => selectLatestBySale(rows, 'penjualan_offline_id', to);
const selectLatestDisplaySps = (rows, to) => selectLatestBySale(rows, 'penjualan_offline_id', to);

function offlineDisplaySpTotal(displayPenjualan, soldPenjualans = [], mutationItemsOut = []) {
  const sisaDisplay = (displayPenjualan?.items || []).reduce((sum, item) => sum + itemSubtotal(item), 0);
  const sudahDiprosesJual = (soldPenjualans || []).reduce((sum, sale) => (
    sum + (sale.items || []).reduce((itemSum, item) => itemSum + itemSubtotal(item), 0)
  ), 0);
  const sudahMutasiKeluar = (mutationItemsOut || []).reduce((sum, item) => sum + itemSubtotal(item), 0);
  return money(sisaDisplay + sudahDiprosesJual + sudahMutasiKeluar);
}

async function buildPiutangEntries(isTest, source = '', to = '', scope = {}) {
  const data = await invoiceBasis.load({ source, isTest, to, scope });
  return data.entries.map(entry => ({
    ...entry, customer_key: customerKey(entry.customer),
    piutang_key: `${entry.sumber}:${entry.faktur}:${customerKey(entry.customer)}`,
    debit: money(entry.debit), kredit: money(entry.kredit), nilai: money(entry.debit - entry.kredit),
    // Do not serialize ORM parents or internal allocation state in public reports.
    sale: undefined, raw: undefined,
  }));
}

router.get('/rekap', authenticate, async (req, res) => {
  try {
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const { from, to, search, sumber, faktur, page = 1, limit = 25, all } = req.query;
    const sourceFilter = ['OFFLINE', 'INTERIOR', 'ONLINE'].includes(String(sumber || '').toUpperCase()) ? String(sumber).toUpperCase() : '';
    const fakturFilter = ['FAKTUR', 'NON_FAKTUR'].includes(String(faktur || '').toUpperCase()) ? String(faktur).toUpperCase() : '';
    let entries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0, sourceFilter, to, { faktur: fakturFilter, search }))
      .filter(entry => entryMatches(entry, { sumber: sourceFilter, faktur: fakturFilter }));
    entries = filterLedgerBySearch(entries, search);

    const map = new Map();
    for (const entry of entries) {
      if (!map.has(entry.piutang_key)) {
        map.set(entry.piutang_key, {
          customer_key: entry.piutang_key,
          nama_key: entry.customer_key,
          sumber: entry.sumber,
          faktur: entry.faktur,
          nama_customer: entry.customer,
          saldo_awal: 0,
          debit: 0,
          kredit: 0,
          saldo_akhir: 0,
          jumlah_transaksi: 0,
        });
      }
      const row = map.get(entry.piutang_key);
      if (from && entry.tanggal < from) {
        row.saldo_awal += entry.debit - entry.kredit;
      } else if (inPeriod(entry.tanggal, from, to)) {
        row.debit += entry.debit;
        row.kredit += entry.kredit;
        row.jumlah_transaksi += 1;
      }
    }

    const allRows = [...map.values()]
      .map(row => ({
        ...row,
        saldo_awal: money(row.saldo_awal),
        debit: money(row.debit),
        kredit: money(row.kredit),
        saldo_akhir: money(row.saldo_awal + row.debit - row.kredit),
        piutang: Math.max(0, money(row.saldo_awal + row.debit - row.kredit)),
        lebih_bayar: Math.max(0, -money(row.saldo_awal + row.debit - row.kredit)),
      }))
      .filter(row => row.saldo_awal !== 0 || row.debit !== 0 || row.kredit !== 0 || row.saldo_akhir !== 0)
      .sort((a, b) => b.saldo_akhir - a.saldo_akhir || a.nama_customer.localeCompare(b.nama_customer));

    const emptySummary = () => ({ saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0, piutang: 0, lebihBayar: 0, customers: 0 });
    const addSummary = (acc, row) => {
      acc.saldoAwal += row.saldo_awal;
      acc.debit += row.debit;
      acc.kredit += row.kredit;
      acc.saldoAkhir += row.saldo_akhir;
      acc.piutang += row.piutang;
      acc.lebihBayar += row.lebih_bayar;
      acc.customers += 1;
      return acc;
    };
    const summary = allRows.reduce(addSummary, emptySummary());
    const breakdown = {
      OFFLINE: { total: emptySummary(), FAKTUR: emptySummary(), NON_FAKTUR: emptySummary() },
      INTERIOR: { total: emptySummary(), FAKTUR: emptySummary(), NON_FAKTUR: emptySummary() },
      ONLINE: { total: emptySummary(), FAKTUR: emptySummary(), NON_FAKTUR: emptySummary() },
    };
    allRows.forEach(row => {
      if (breakdown[row.sumber]) {
        addSummary(breakdown[row.sumber].total, row);
        addSummary(breakdown[row.sumber][row.faktur], row);
      }
    });

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;
    res.json({
      data: String(all) === 'true' ? allRows : allRows.slice(offset, offset + limitInt),
      summary,
      breakdown,
      total: allRows.length,
      page: pageInt,
      totalPages: Math.max(1, Math.ceil(allRows.length / limitInt)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/detail', authenticate, async (req, res) => {
  try {
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const { from, to, search, sumber, faktur, customer_key, page = 1, limit = 100, all } = req.query;
    const sourceFilter = ['OFFLINE', 'INTERIOR', 'ONLINE'].includes(String(sumber || '').toUpperCase()) ? String(sumber).toUpperCase() : '';
    const fakturFilter = ['FAKTUR', 'NON_FAKTUR'].includes(String(faktur || '').toUpperCase()) ? String(faktur).toUpperCase() : '';
    let allEntries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0, sourceFilter, to, { faktur: fakturFilter, customer_key, search }))
      .filter(entry => entryMatches(entry, { customer_key, sumber: sourceFilter, faktur: fakturFilter }));
    if (!customer_key) allEntries = filterLedgerBySearch(allEntries, search);

    const saldoAwal = from
      ? allEntries.filter(entry => entry.tanggal < from).reduce((sum, entry) => sum + entry.debit - entry.kredit, 0)
      : 0;

    let saldo = money(saldoAwal);
    const periodEntries = allEntries.filter(entry => inPeriod(entry.tanggal, from, to));
    const detailRows = [
      ...(from ? [{
        id: 'SALDO-AWAL',
        tanggal: from || null,
        sumber: '-',
        faktur: '-',
        jenis: 'SALDO_AWAL',
        referensi: '-',
        customer: customer_key ? (allEntries[0]?.customer || '-') : 'Semua Customer',
        customer_key: customer_key || '',
        piutang_key: customer_key || '',
        no_po: '',
        keterangan: 'Saldo Awal',
        debit: 0,
        kredit: 0,
        saldo,
      }] : []),
      ...periodEntries.map(entry => {
        saldo = money(saldo + entry.debit - entry.kredit);
        return { ...entry, saldo };
      }),
    ];

    const summary = detailRows.reduce((acc, row) => {
      acc.debit += row.debit || 0;
      acc.kredit += row.kredit || 0;
      return acc;
    }, { saldoAwal: money(saldoAwal), debit: 0, kredit: 0, saldoAkhir: saldo });
    summary.saldoAkhir = detailRows[detailRows.length - 1]?.saldo ?? money(saldoAwal);

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;
    res.json({
      data: String(all) === 'true' ? detailRows : detailRows.slice(offset, offset + limitInt),
      summary,
      total: detailRows.length,
      page: pageInt,
      totalPages: Math.max(1, Math.ceil(detailRows.length / limitInt)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.get('/uang-muka-interior', authenticate, async (req, res) => {
  try {
    const dateError = financeDateRangeError(req.query);
    if (dateError) return res.status(400).json({ message: dateError });
    const { from, to, search, status, key, page = 1, limit = 25, all } = req.query;
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const documentWhere = to ? { tanggal: { [Op.lte]: to } } : {};
    const [interiorInvoices, interiorPayments, interiorSubInvoices] = await Promise.all([
      InvoiceInterior.findAll({
        where: documentWhere,
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
      PembayaranInterior.findAll({
        where: documentWhere,
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }],
      }),
      ProformaInvoice.findAll({
        where: { ...documentWhere, nomor_sub_invoice: { [Op.ne]: null } },
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
    ]);
    const getInvoiceAmount = await prepareInvoiceAmounts(interiorInvoices);
    const effectiveInteriorInvoices = await buildEffectiveInteriorInvoices(interiorInvoices, interiorSubInvoices, getInvoiceAmount);
    const state = await buildInteriorAdvanceState(effectiveInteriorInvoices, interiorPayments);
    const q = String(search || '').trim().toLowerCase();
    const statusFilter = String(status || '').toUpperCase();

    const historyByKey = new Map();
    for (const event of state.history) {
      if (!historyByKey.has(event.key)) historyByKey.set(event.key, []);
      historyByKey.get(event.key).push(event);
    }

    let rows = state.rekapRows.map(row => {
      const events = historyByKey.get(row.key) || [];
      const throughEnd = events.filter(event => !to || event.tanggal <= to);
      const inRange = throughEnd.filter(event => !from || event.tanggal >= from);
      return {
        ...row,
        uang_muka_masuk: money(inRange.reduce((sum, event) => sum + event.masuk, 0)),
        uang_muka_terpakai: money(inRange.reduce((sum, event) => sum + event.terpakai, 0)),
        sisa_uang_muka: money(throughEnd[throughEnd.length - 1]?.sisa || 0),
        jumlah_transaksi: inRange.length,
        status: money(throughEnd[throughEnd.length - 1]?.sisa || 0) <= 0
          ? 'HABIS_TERPAKAI'
          : throughEnd.some(event => event.terpakai > 0) ? 'TERPAKAI_SEBAGIAN' : 'BELUM_TERPAKAI',
      };
    }).filter(row => {
      if (key && row.key !== key) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (q) {
        const text = [row.nama_customer, row.no_po, row.faktur, row.status].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return row.jumlah_transaksi > 0 || row.sisa_uang_muka !== 0;
    });

    const history = state.history.filter(row => {
      if (key && row.key !== key) return false;
      if (from && row.tanggal < from) return false;
      if (to && row.tanggal > to) return false;
      if (q) {
        const text = [row.nama_customer, row.no_po, row.keterangan, row.referensi, row.faktur].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    rows = rows.sort((a, b) => b.sisa_uang_muka - a.sisa_uang_muka || a.nama_customer.localeCompare(b.nama_customer));
    const summary = rows.reduce((acc, row) => {
      acc.masuk += row.uang_muka_masuk;
      acc.terpakai += row.uang_muka_terpakai;
      acc.sisa += row.sisa_uang_muka;
      acc.proyek += 1;
      if (row.sisa_uang_muka > 0) acc.aktif += 1;
      return acc;
    }, { masuk: 0, terpakai: 0, sisa: 0, proyek: 0, aktif: 0 });

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;
    const source = key ? history : rows;
    res.json({
      data: String(all) === 'true' ? source : source.slice(offset, offset + limitInt),
      summary,
      total: source.length,
      page: pageInt,
      totalPages: Math.max(1, Math.ceil(source.length / limitInt)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.__testables = {
  buildInteriorAdvanceState,
  filterLedgerBySearch,
  selectLatestOfflineInvoices,
  selectLatestDisplaySps,
  offlineDisplaySpTotal,
};
module.exports = router;
