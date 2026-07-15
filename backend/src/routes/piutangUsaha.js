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

function entryMatches(entry, { search, customer_key }) {
  if (customer_key && entry.customer_key !== customer_key) return false;
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
      no_po: r.penjualan?.no_po,
      keterangan: `Retur Offline${r.catatan ? ` - ${r.catatan}` : ''}`,
      debit: 0,
      kredit: amount,
      detail_url: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
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
      keterangan: `Invoice Interior ${inv.nomor_invoice}`,
      debit: amount.total,
      kredit: 0,
      detail_url: `/dashboard/penjualan/interior/${inv.penjualan_interior_id}`,
    });
  }

  for (const p of interiorPayments) {
    const amount = money(p.jumlah);
    if (amount <= 0) continue;
    push({
      id: `INTERIOR-PEMBAYARAN-${p.id}`,
      tanggal: p.tanggal,
      sumber: 'INTERIOR',
      jenis: 'PEMBAYARAN',
      referensi: p.tipe,
      customer: p.penjualan?.nama_customer,
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
    const { from, to, search, page = 1, limit = 25 } = req.query;
    const entries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0))
      .filter(entry => entryMatches(entry, { search }));

    const map = new Map();
    for (const entry of entries) {
      if (!map.has(entry.customer_key)) {
        map.set(entry.customer_key, {
          customer_key: entry.customer_key,
          nama_customer: entry.customer,
          saldo_awal: 0,
          debit: 0,
          kredit: 0,
          saldo_akhir: 0,
          jumlah_transaksi: 0,
        });
      }
      const row = map.get(entry.customer_key);
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
      }))
      .filter(row => row.saldo_awal !== 0 || row.debit !== 0 || row.kredit !== 0 || row.saldo_akhir !== 0)
      .sort((a, b) => b.saldo_akhir - a.saldo_akhir || a.nama_customer.localeCompare(b.nama_customer));

    const summary = allRows.reduce((acc, row) => {
      acc.saldoAwal += row.saldo_awal;
      acc.debit += row.debit;
      acc.kredit += row.kredit;
      acc.saldoAkhir += row.saldo_akhir;
      return acc;
    }, { saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0 });

    const pageInt = Math.max(1, parseInt(page));
    const limitInt = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageInt - 1) * limitInt;
    res.json({
      data: allRows.slice(offset, offset + limitInt),
      summary,
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
    const { from, to, search, customer_key, page = 1, limit = 100 } = req.query;
    const allEntries = (await buildPiutangEntries(req.user.role === 'TEST' ? 1 : 0))
      .filter(entry => entryMatches(entry, { search, customer_key }));

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
        jenis: 'SALDO_AWAL',
        referensi: '-',
        customer: customer_key ? (allEntries[0]?.customer || '-') : 'Semua Customer',
        customer_key: customer_key || '',
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

module.exports = router;
