const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, Invoice, ReturOffline,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior, InvoiceInterior,
  SuratJalanInterior, SuratJalanInteriorItem, ReturSJInterior,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const money = (v) => Math.round(Number(v || 0));

const customerKey = (name) => String(name || 'Tanpa Nama').trim().toLowerCase().replace(/\s+/g, ' ');

const itemSubtotal = (item) => money(Number(item?.subtotal || 0));
const itemUnitValue = (item) => {
  const qty = Number(item?.qty || 0);
  if (qty <= 0) return 0;
  return Number(item?.subtotal || 0) / qty;
};

const offlineInvoiceTotal = (penjualan, invoice) => {
  const subtotal = money((penjualan.items || []).reduce((sum, item) => sum + itemSubtotal(item), 0));
  const ppn = money(subtotal * Number(invoice.ppn_persen || 0) / 100);
  return { subtotal, ppn, total: money(subtotal + ppn) };
};

const latestOfflinePpn = (penjualan) => {
  const invoices = penjualan?.invoices || [];
  if (!invoices.length) return 0;
  return Number(invoices[invoices.length - 1]?.ppn_persen || 0);
};

const offlineReturTotal = (retur) => {
  const base = money(itemUnitValue(retur.item) * Number(retur.qty_retur || 0));
  const ppnPersen = latestOfflinePpn(retur.penjualan);
  const ppn = money(base * ppnPersen / 100);
  return money(base + ppn);
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
        subtotal += itemUnitValue(sjItem.item) * Number(sjItem.qty_kirim || 0);
      }
    }
  } else {
    subtotal = (inv.penjualan?.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  }

  subtotal = money(subtotal);
  const ppn = inv.penjualan?.pakai_ppn ? money(subtotal * Number(inv.penjualan.ppn_persen || 0) / 100) : 0;
  return { subtotal, ppn, total: money(subtotal + ppn) };
}


async function buildInteriorAdvanceState(interiorInvoices, interiorPayments) {
  const byPenjualan = new Map();
  const ensure = (id, penjualan) => {
    if (!byPenjualan.has(id)) byPenjualan.set(id, { penjualan, invoices: [], payments: [] });
    const row = byPenjualan.get(id);
    if (!row.penjualan && penjualan) row.penjualan = penjualan;
    return row;
  };

  for (const inv of interiorInvoices || []) {
    const id = Number(inv.penjualan_interior_id || inv.penjualan?.id);
    if (!id) continue;
    const amount = await invoiceInteriorAmount(inv);
    ensure(id, inv.penjualan).invoices.push({ inv, amount });
  }

  for (const p of interiorPayments || []) {
    const id = Number(p.penjualan_interior_id || p.penjualan?.id);
    if (!id) continue;
    ensure(id, p.penjualan).payments.push(p);
  }

  const advancePaymentIds = new Set();
  const usageByInvoice = new Map();
  const history = [];
  const rekapMap = new Map();

  for (const [penjualanId, row] of byPenjualan.entries()) {
    row.invoices.sort((a, b) => String(a.inv.tanggal).localeCompare(String(b.inv.tanggal)) || Number(a.inv.id) - Number(b.inv.id));
    row.payments.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || Number(a.id) - Number(b.id));

    const firstInvoiceDate = row.invoices[0]?.inv?.tanggal || null;
    const advancePayments = row.payments.filter(p => !firstInvoiceDate || String(p.tanggal) < String(firstInvoiceDate));
    if (!advancePayments.length) continue;

    const penjualan = row.penjualan || advancePayments[0]?.penjualan || row.invoices[0]?.inv?.penjualan;
    const customer = penjualan?.nama_customer || 'Tanpa Nama';
    const key = `INTERIOR-UM-${penjualanId}`;
    const rekap = {
      key,
      penjualan_interior_id: penjualanId,
      customer_key: customerKey(customer),
      nama_customer: customer,
      no_po: penjualan?.no_po || '',
      faktur: penjualan?.faktur || 'NON_FAKTUR',
      uang_muka_masuk: 0,
      uang_muka_terpakai: 0,
      sisa_uang_muka: 0,
      jumlah_transaksi: 0,
      detail_url: `/dashboard/penjualan/interior/${penjualanId}`,
    };

    let running = 0;
    for (const pay of advancePayments) {
      const amount = money(pay.jumlah);
      if (amount <= 0) continue;
      advancePaymentIds.add(Number(pay.id));
      running = money(running + amount);
      rekap.uang_muka_masuk += amount;
      rekap.jumlah_transaksi += 1;
      history.push({
        id: `UM-MASUK-${pay.id}`,
        key,
        penjualan_interior_id: penjualanId,
        tanggal: pay.tanggal,
        jenis: 'UANG_MUKA_MASUK',
        referensi: pay.tipe,
        nama_customer: customer,
        no_po: rekap.no_po,
        faktur: rekap.faktur,
        keterangan: `Uang muka Interior ${pay.tipe}${pay.catatan ? ` - ${pay.catatan}` : ''}`,
        masuk: amount,
        terpakai: 0,
        sisa: running,
        bukti_endpoint: pay.bukti_bayar ? `/penjualan-interior/${penjualanId}/pembayaran/${pay.id}/bukti` : null,
        detail_url: rekap.detail_url,
      });
    }

    let remaining = money(rekap.uang_muka_masuk);
    for (const { inv, amount } of row.invoices) {
      if (remaining <= 0) break;
      const used = Math.min(remaining, money(amount.total));
      if (used <= 0) continue;
      remaining = money(remaining - used);
      usageByInvoice.set(Number(inv.id), used);
      rekap.uang_muka_terpakai += used;
      rekap.jumlah_transaksi += 1;
      history.push({
        id: `UM-TERPAKAI-${inv.id}`,
        key,
        penjualan_interior_id: penjualanId,
        tanggal: inv.tanggal,
        jenis: 'UANG_MUKA_TERPAKAI',
        referensi: inv.nomor_invoice,
        nama_customer: customer,
        no_po: rekap.no_po,
        faktur: rekap.faktur,
        keterangan: `Uang muka dipakai untuk Invoice Interior ${inv.nomor_invoice}`,
        masuk: 0,
        terpakai: used,
        sisa: remaining,
        bukti_endpoint: null,
        detail_url: rekap.detail_url,
      });
    }

    rekap.uang_muka_masuk = money(rekap.uang_muka_masuk);
    rekap.uang_muka_terpakai = money(rekap.uang_muka_terpakai);
    rekap.sisa_uang_muka = money(rekap.uang_muka_masuk - rekap.uang_muka_terpakai);
    rekap.status = rekap.sisa_uang_muka <= 0 ? 'HABIS_TERPAKAI' : rekap.uang_muka_terpakai > 0 ? 'TERPAKAI_SEBAGIAN' : 'BELUM_TERPAKAI';
    rekapMap.set(key, rekap);
  }

  history.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.id).localeCompare(String(b.id)));
  return { advancePaymentIds, usageByInvoice, history, rekapRows: [...rekapMap.values()] };
}

const interiorReturTotal = (retur) => {
  const item = retur.item;
  const penjualan = item?.penjualan;
  const base = money(itemUnitValue(item) * Number(retur.qty_retur || 0));
  const ppn = penjualan?.pakai_ppn ? money(base * Number(penjualan.ppn_persen || 0) / 100) : 0;
  return money(base + ppn);
};

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

async function buildPiutangEntries(isTest) {
  const entries = [];
  const push = (entry) => {
    const customer = entry.customer || 'Tanpa Nama';
    entries.push({
      ...entry,
      customer,
      customer_key: customerKey(customer),
      faktur: entry.faktur || 'NON_FAKTUR',
      piutang_key: `${entry.sumber}:${entry.faktur || 'NON_FAKTUR'}:${customerKey(customer)}`,
      debit: money(entry.debit),
      kredit: money(entry.kredit),
      nilai: money(Number(entry.debit || 0) - Number(entry.kredit || 0)),
    });
  };

  const [offlineInvoices, offlinePayments, offlineReturs, interiorInvoices, interiorPayments, interiorReturs] = await Promise.all([
    Invoice.findAll({
      include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanOfflineItem, as: 'items' }] }],
    }),
    PembayaranOffline.findAll({
      include: [{ model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest } }],
    }),
    ReturOffline.findAll({
      include: [
        { model: PenjualanOffline, as: 'penjualan', where: { is_test: isTest }, include: [{ model: Invoice, as: 'invoices' }] },
        { model: PenjualanOfflineItem, as: 'item' },
      ],
    }),
    InvoiceInterior.findAll({
      include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
    }),
    PembayaranInterior.findAll({
      include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }],
    }),
    ReturSJInterior.findAll({
      include: [{ model: PenjualanInteriorItem, as: 'item', include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }] }],
    }),
  ]);

  for (const inv of offlineInvoices) {
    const amount = offlineInvoiceTotal(inv.penjualan, inv);
    if (amount.total <= 0) continue;
    push({
      id: `OFFLINE-INVOICE-${inv.id}`,
      tanggal: inv.tanggal,
      sumber: 'OFFLINE',
      jenis: 'INVOICE',
      referensi: inv.nomor_invoice,
      customer: inv.penjualan?.nama_penerima,
      faktur: inv.penjualan?.faktur,
      no_po: inv.penjualan?.no_po,
      keterangan: `Invoice Offline ${inv.nomor_invoice}`,
      debit: amount.total,
      kredit: 0,
      detail_url: `/dashboard/penjualan/offline/${inv.penjualan_offline_id}`,
    });
  }

  for (const p of offlinePayments) {
    const amount = money(p.jumlah);
    if (amount <= 0) continue;
    push({
      id: `OFFLINE-PEMBAYARAN-${p.id}`,
      tanggal: p.tanggal,
      sumber: 'OFFLINE',
      jenis: 'PEMBAYARAN',
      referensi: p.metode,
      customer: p.penjualan?.nama_penerima,
      faktur: p.penjualan?.faktur,
      no_po: p.penjualan?.no_po,
      keterangan: `Pembayaran Offline ${p.metode}${p.catatan ? ` - ${p.catatan}` : ''}`,
      debit: 0,
      kredit: amount,
      bukti_endpoint: p.bukti_bayar ? `/penjualan-offline/${p.penjualan_offline_id}/pembayaran/${p.id}/bukti` : null,
      detail_url: `/dashboard/penjualan/offline/${p.penjualan_offline_id}`,
    });
  }

  for (const r of offlineReturs) {
    const amount = offlineReturTotal(r);
    if (amount <= 0) continue;
    push({
      id: `OFFLINE-RETUR-${r.id}`,
      tanggal: r.tanggal,
      sumber: 'OFFLINE',
      jenis: 'RETUR',
      referensi: `Retur #${r.id}`,
      customer: r.penjualan?.nama_penerima,
      faktur: r.penjualan?.faktur,
      no_po: r.penjualan?.no_po,
      keterangan: `Retur Offline${r.catatan ? ` - ${r.catatan}` : ''}`,
      debit: 0,
      kredit: amount,
      detail_url: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
    });
  }

  const interiorAdvanceState = await buildInteriorAdvanceState(interiorInvoices, interiorPayments);

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
      faktur: inv.penjualan?.faktur,
      no_po: inv.penjualan?.no_po,
      keterangan: `Invoice Interior ${inv.nomor_invoice}`,
      debit: amount.total,
      kredit: 0,
      detail_url: `/dashboard/penjualan/interior/${inv.penjualan_interior_id}`,
    });

    const uangMukaTerpakai = interiorAdvanceState.usageByInvoice.get(Number(inv.id)) || 0;
    if (uangMukaTerpakai > 0) {
      push({
        id: `INTERIOR-UANG-MUKA-TERPAKAI-${inv.id}`,
        tanggal: inv.tanggal,
        sumber: 'INTERIOR',
        jenis: 'UANG_MUKA_TERPAKAI',
        referensi: inv.nomor_invoice,
        customer: inv.penjualan?.nama_customer,
        faktur: inv.penjualan?.faktur,
        no_po: inv.penjualan?.no_po,
        keterangan: `Uang muka dipakai untuk Invoice Interior ${inv.nomor_invoice}`,
        debit: 0,
        kredit: uangMukaTerpakai,
        detail_url: `/dashboard/penjualan/interior/${inv.penjualan_interior_id}`,
      });
    }
  }

  for (const p of interiorPayments) {
    if (interiorAdvanceState.advancePaymentIds.has(Number(p.id))) continue;
    const amount = money(p.jumlah);
    if (amount <= 0) continue;
    push({
      id: `INTERIOR-PEMBAYARAN-${p.id}`,
      tanggal: p.tanggal,
      sumber: 'INTERIOR',
      jenis: 'PEMBAYARAN',
      referensi: p.tipe,
      customer: p.penjualan?.nama_customer,
      faktur: p.penjualan?.faktur,
      no_po: p.penjualan?.no_po,
      keterangan: `Pembayaran Interior ${p.tipe}${p.catatan ? ` - ${p.catatan}` : ''}`,
      debit: 0,
      kredit: amount,
      bukti_endpoint: p.bukti_bayar ? `/penjualan-interior/${p.penjualan_interior_id}/pembayaran/${p.id}/bukti` : null,
      detail_url: `/dashboard/penjualan/interior/${p.penjualan_interior_id}`,
    });
  }

  for (const r of interiorReturs) {
    const amount = interiorReturTotal(r);
    const penjualan = r.item?.penjualan;
    if (amount <= 0) continue;
    push({
      id: `INTERIOR-RETUR-${r.id}`,
      tanggal: r.tanggal,
      sumber: 'INTERIOR',
      jenis: 'RETUR',
      referensi: `Retur SJ #${r.surat_jalan_interior_id}`,
      customer: penjualan?.nama_customer,
      faktur: penjualan?.faktur,
      no_po: penjualan?.no_po,
      keterangan: `Retur Interior${r.catatan ? ` - ${r.catatan}` : ''}`,
      debit: 0,
      kredit: amount,
      detail_url: `/dashboard/penjualan/interior/${r.item?.penjualan_interior_id}`,
    });
  }

  return entries.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.id).localeCompare(String(b.id)));
}

router.get('/rekap', authenticate, async (req, res) => {
  try {
    const { from, to, search, sumber, faktur, page = 1, limit = 25 } = req.query;
    const sourceFilter = ['OFFLINE', 'INTERIOR'].includes(String(sumber || '').toUpperCase()) ? String(sumber).toUpperCase() : '';
    const fakturFilter = ['FAKTUR', 'NON_FAKTUR'].includes(String(faktur || '').toUpperCase()) ? String(faktur).toUpperCase() : '';
    const entries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0))
      .filter(entry => entryMatches(entry, { search, sumber: sourceFilter, faktur: fakturFilter }));

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
      data: allRows.slice(offset, offset + limitInt),
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
    const { from, to, search, sumber, faktur, customer_key, page = 1, limit = 100 } = req.query;
    const sourceFilter = ['OFFLINE', 'INTERIOR'].includes(String(sumber || '').toUpperCase()) ? String(sumber).toUpperCase() : '';
    const fakturFilter = ['FAKTUR', 'NON_FAKTUR'].includes(String(faktur || '').toUpperCase()) ? String(faktur).toUpperCase() : '';
    const allEntries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0))
      .filter(entry => entryMatches(entry, { search, customer_key, sumber: sourceFilter, faktur: fakturFilter }));

    const saldoAwal = from
      ? allEntries.filter(entry => entry.tanggal < from).reduce((sum, entry) => sum + entry.debit - entry.kredit, 0)
      : 0;

    let saldo = money(saldoAwal);
    const periodEntries = allEntries.filter(entry => inPeriod(entry.tanggal, from, to));
    const detailRows = [
      {
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
      },
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
    summary.saldoAkhir = detailRows[detailRows.length - 1]?.saldo || money(saldoAwal);

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;
    res.json({
      data: detailRows.slice(offset, offset + limitInt),
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
    const { from, to, search, status, key, page = 1, limit = 25 } = req.query;
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const [interiorInvoices, interiorPayments] = await Promise.all([
      InvoiceInterior.findAll({
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest }, include: [{ model: PenjualanInteriorItem, as: 'items' }] }],
      }),
      PembayaranInterior.findAll({
        include: [{ model: PenjualanInterior, as: 'penjualan', where: { is_test: isTest } }],
      }),
    ]);
    const state = await buildInteriorAdvanceState(interiorInvoices, interiorPayments);
    const q = String(search || '').trim().toLowerCase();
    const statusFilter = String(status || '').toUpperCase();

    let rows = state.rekapRows.filter(row => {
      if (key && row.key !== key) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (q) {
        const text = [row.nama_customer, row.no_po, row.faktur, row.status].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return row.uang_muka_masuk !== 0 || row.uang_muka_terpakai !== 0 || row.sisa_uang_muka !== 0;
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
      data: source.slice(offset, offset + limitInt),
      summary,
      total: source.length,
      page: pageInt,
      totalPages: Math.max(1, Math.ceil(source.length / limitInt)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
