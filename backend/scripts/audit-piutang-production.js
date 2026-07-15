/*
 * Audit Piutang Produksi (READ-ONLY)
 *
 * Tujuan:
 * - Membaca data customer/transaksi dari penjualan offline & interior.
 * - Mendeteksi nama customer duplikat/mirip.
 * - Menghitung estimasi mutasi piutang dari invoice, pembayaran, retur.
 * - Menghasilkan file JSON + CSV di ../docs tanpa mengubah database.
 *
 * Cara jalan di server:
 *   cd /mine/sistem_ilena/html/backend
 *   node scripts/audit-piutang-production.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, Invoice, ReturOffline,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior, InvoiceInterior,
  SuratJalanInterior, SuratJalanInteriorItem, ReturSJInterior,
} = require('../src/models');

const money = (v) => Math.round(Number(v || 0));
const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/\b(pt|cv|tbk|ud|toko|bpk|bapak|ibu|mr|mrs|ms)\b\.?/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const compact = (s) => norm(s).replace(/\s+/g, '');
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  const max = Math.max(a.length, b.length) || 1;
  return 1 - (levenshtein(a, b) / max);
}

const itemUnitValue = (item) => {
  const qty = Number(item?.qty || 0);
  if (qty <= 0) return 0;
  return Number(item?.subtotal || 0) / qty;
};

const itemSubtotal = (item) => money(Number(item?.subtotal || 0));

function offlineInvoiceTotal(penjualan, invoice) {
  const subtotal = money((penjualan?.items || []).reduce((s, item) => s + itemSubtotal(item), 0));
  const ppn = money(subtotal * Number(invoice?.ppn_persen || 0) / 100);
  return money(subtotal + ppn);
}

function latestOfflinePpn(penjualan) {
  const invoices = penjualan?.invoices || [];
  if (!invoices.length) return 0;
  return Number(invoices[invoices.length - 1]?.ppn_persen || 0);
}

function offlineReturTotal(retur) {
  const base = money(itemUnitValue(retur.item) * Number(retur.qty_retur || 0));
  const ppn = money(base * latestOfflinePpn(retur.penjualan) / 100);
  return money(base + ppn);
}

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
    subtotal = (inv.penjualan?.items || []).reduce((s, item) => s + Number(item.subtotal || 0), 0);
  }

  subtotal = money(subtotal);
  const ppn = inv.penjualan?.pakai_ppn ? money(subtotal * Number(inv.penjualan.ppn_persen || 0) / 100) : 0;
  return money(subtotal + ppn);
}

function interiorReturTotal(retur) {
  const item = retur.item;
  const penjualan = item?.penjualan;
  const base = money(itemUnitValue(item) * Number(retur.qty_retur || 0));
  const ppn = penjualan?.pakai_ppn ? money(base * Number(penjualan.ppn_persen || 0) / 100) : 0;
  return money(base + ppn);
}

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName`,
    { replacements: { tableName } }
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function safeCount(tableName) {
  if (!(await tableExists(tableName))) return { exists: false, count: 0 };
  const [rows] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${tableName}\``);
  return { exists: true, count: Number(rows[0]?.c || 0) };
}

async function collectNameStats() {
  const [offline] = await sequelize.query(`
    SELECT nama_penerima AS nama, COUNT(*) total, MIN(tanggal) first_date, MAX(tanggal) last_date,
           SUM(CASE WHEN is_test=1 THEN 1 ELSE 0 END) test_rows
    FROM penjualan_offline
    WHERE nama_penerima IS NOT NULL AND TRIM(nama_penerima) <> ''
    GROUP BY nama_penerima
    ORDER BY total DESC, nama_penerima ASC
  `).catch(() => [[]]);

  const [interior] = await sequelize.query(`
    SELECT nama_customer AS nama, COUNT(*) total, MIN(tanggal) first_date, MAX(tanggal) last_date,
           SUM(CASE WHEN is_test=1 THEN 1 ELSE 0 END) test_rows
    FROM penjualan_interior
    WHERE nama_customer IS NOT NULL AND TRIM(nama_customer) <> ''
    GROUP BY nama_customer
    ORDER BY total DESC, nama_customer ASC
  `).catch(() => [[]]);

  const rows = [
    ...offline.map(r => ({ sumber: 'OFFLINE', ...r, normalized: norm(r.nama), compact: compact(r.nama) })),
    ...interior.map(r => ({ sumber: 'INTERIOR', ...r, normalized: norm(r.nama), compact: compact(r.nama) })),
  ];

  const byExact = {};
  const byNorm = {};
  for (const r of rows) {
    const exact = String(r.nama || '').trim().toLowerCase();
    byExact[exact] ||= [];
    byExact[exact].push(r);
    byNorm[r.normalized] ||= [];
    byNorm[r.normalized].push(r);
  }

  const exactDuplicates = Object.values(byExact).filter(g => g.length > 1);
  const normalizedDuplicates = Object.values(byNorm).filter(g => g.length > 1 && g.some(x => x.nama !== g[0].nama));
  const similarPairs = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (!a.compact || !b.compact) continue;
      if (a.compact === b.compact || a.normalized === b.normalized) continue;
      const score = similarity(a.compact, b.compact);
      const contains = a.compact.length >= 5 && b.compact.length >= 5 && (a.compact.includes(b.compact) || b.compact.includes(a.compact));
      if (score >= 0.86 || contains) similarPairs.push({ score: Number(score.toFixed(3)), a, b });
    }
  }
  similarPairs.sort((a, b) => b.score - a.score);

  return { allNames: rows, exactDuplicates, normalizedDuplicates, similarPairs };
}

async function collectPiutangEntries() {
  const entries = [];
  const push = (entry) => {
    const customer = entry.customer || 'Tanpa Nama';
    entries.push({
      ...entry,
      customer,
      normalized_customer: norm(customer),
      source_customer_key: `${entry.sumber}:${norm(customer)}`,
      is_test: Number(entry.is_test || 0),
      debit: money(entry.debit),
      kredit: money(entry.kredit),
      net: money(Number(entry.debit || 0) - Number(entry.kredit || 0)),
    });
  };

  const jobs = [];
  if (await tableExists('invoice')) jobs.push(Invoice.findAll({ include: [{ model: PenjualanOffline, as: 'penjualan', include: [{ model: PenjualanOfflineItem, as: 'items' }] }] })); else jobs.push(Promise.resolve([]));
  if (await tableExists('pembayaran_offline')) jobs.push(PembayaranOffline.findAll({ include: [{ model: PenjualanOffline, as: 'penjualan' }] })); else jobs.push(Promise.resolve([]));
  if (await tableExists('retur_offline')) jobs.push(ReturOffline.findAll({ include: [{ model: PenjualanOffline, as: 'penjualan', include: [{ model: Invoice, as: 'invoices' }] }, { model: PenjualanOfflineItem, as: 'item' }] })); else jobs.push(Promise.resolve([]));
  if (await tableExists('invoice_interior')) jobs.push(InvoiceInterior.findAll({ include: [{ model: PenjualanInterior, as: 'penjualan', include: [{ model: PenjualanInteriorItem, as: 'items' }] }] })); else jobs.push(Promise.resolve([]));
  if (await tableExists('pembayaran_interior')) jobs.push(PembayaranInterior.findAll({ include: [{ model: PenjualanInterior, as: 'penjualan' }] })); else jobs.push(Promise.resolve([]));
  if (await tableExists('retur_sj_interior')) jobs.push(ReturSJInterior.findAll({ include: [{ model: PenjualanInteriorItem, as: 'item', include: [{ model: PenjualanInterior, as: 'penjualan' }] }] })); else jobs.push(Promise.resolve([]));

  const [offlineInvoices, offlinePayments, offlineReturs, interiorInvoices, interiorPayments, interiorReturs] = await Promise.all(jobs);

  for (const inv of offlineInvoices) {
    const amount = offlineInvoiceTotal(inv.penjualan, inv);
    if (amount <= 0) continue;
    push({ sumber: 'OFFLINE', jenis: 'INVOICE', tanggal: inv.tanggal, reference_no: inv.nomor_invoice, customer: inv.penjualan?.nama_penerima, no_po: inv.penjualan?.no_po, is_test: inv.penjualan?.is_test, debit: amount, kredit: 0 });
  }
  for (const p of offlinePayments) {
    const amount = money(p.jumlah);
    if (amount <= 0) continue;
    push({ sumber: 'OFFLINE', jenis: 'PEMBAYARAN', tanggal: p.tanggal, reference_no: p.metode, customer: p.penjualan?.nama_penerima, no_po: p.penjualan?.no_po, is_test: p.penjualan?.is_test, debit: 0, kredit: amount });
  }
  for (const r of offlineReturs) {
    const amount = offlineReturTotal(r);
    if (amount <= 0) continue;
    push({ sumber: 'OFFLINE', jenis: 'RETUR', tanggal: r.tanggal, reference_no: `Retur #${r.id}`, customer: r.penjualan?.nama_penerima, no_po: r.penjualan?.no_po, is_test: r.penjualan?.is_test, debit: 0, kredit: amount });
  }
  for (const inv of interiorInvoices) {
    const amount = await invoiceInteriorAmount(inv);
    if (amount <= 0) continue;
    push({ sumber: 'INTERIOR', jenis: 'INVOICE', tanggal: inv.tanggal, reference_no: inv.nomor_invoice, customer: inv.penjualan?.nama_customer, no_po: inv.penjualan?.no_po, is_test: inv.penjualan?.is_test, debit: amount, kredit: 0 });
  }
  for (const p of interiorPayments) {
    const amount = money(p.jumlah);
    if (amount <= 0) continue;
    push({ sumber: 'INTERIOR', jenis: 'PEMBAYARAN', tanggal: p.tanggal, reference_no: p.tipe, customer: p.penjualan?.nama_customer, no_po: p.penjualan?.no_po, is_test: p.penjualan?.is_test, debit: 0, kredit: amount });
  }
  for (const r of interiorReturs) {
    const amount = interiorReturTotal(r);
    if (amount <= 0) continue;
    const penjualan = r.item?.penjualan;
    push({ sumber: 'INTERIOR', jenis: 'RETUR', tanggal: r.tanggal, reference_no: `Retur SJ #${r.surat_jalan_interior_id}`, customer: penjualan?.nama_customer, no_po: penjualan?.no_po, is_test: penjualan?.is_test, debit: 0, kredit: amount });
  }

  return entries;
}

function summarizePiutang(entries) {
  const bySourceCustomer = {};
  const byNormalizedCustomer = {};
  for (const e of entries) {
    bySourceCustomer[e.source_customer_key] ||= { sumber: e.sumber, customer: e.customer, normalized_customer: e.normalized_customer, debit: 0, kredit: 0, saldo: 0, count: 0 };
    byNormalizedCustomer[e.normalized_customer] ||= { customer: e.customer, normalized_customer: e.normalized_customer, sumber_list: new Set(), debit: 0, kredit: 0, saldo: 0, count: 0 };
    for (const bucket of [bySourceCustomer[e.source_customer_key], byNormalizedCustomer[e.normalized_customer]]) {
      bucket.debit += e.debit;
      bucket.kredit += e.kredit;
      bucket.saldo += e.debit - e.kredit;
      bucket.count += 1;
      if (bucket.sumber_list) bucket.sumber_list.add(e.sumber);
    }
  }
  return {
    bySourceCustomer: Object.values(bySourceCustomer).map(x => {
      const saldo = money(x.saldo);
      return { ...x, debit: money(x.debit), kredit: money(x.kredit), saldo, piutang: Math.max(0, saldo), lebih_bayar: Math.max(0, -saldo) };
    }).sort((a, b) => b.saldo - a.saldo),
    byNormalizedCustomer: Object.values(byNormalizedCustomer).map(x => {
      const saldo = money(x.saldo);
      return { ...x, sumber_list: [...x.sumber_list], debit: money(x.debit), kredit: money(x.kredit), saldo, piutang: Math.max(0, saldo), lebih_bayar: Math.max(0, -saldo) };
    }).sort((a, b) => b.saldo - a.saldo),
  };
}

function summarizeEntries(label, entries) {
  const totalDebit = money(entries.reduce((s, e) => s + e.debit, 0));
  const totalKredit = money(entries.reduce((s, e) => s + e.kredit, 0));
  const net = money(totalDebit - totalKredit);
  const piutang = summarizePiutang(entries);
  return {
    label,
    entry_count: entries.length,
    total_debit: totalDebit,
    total_kredit: totalKredit,
    net_saldo: net,
    total_piutang: money(piutang.bySourceCustomer.reduce((s, x) => s + x.piutang, 0)),
    total_lebih_bayar: money(piutang.bySourceCustomer.reduce((s, x) => s + x.lebih_bayar, 0)),
    customers_with_piutang: piutang.bySourceCustomer.filter(x => x.piutang > 0).length,
    customers_with_lebih_bayar: piutang.bySourceCustomer.filter(x => x.lebih_bayar > 0).length,
    bySourceCustomer: piutang.bySourceCustomer,
    byNormalizedCustomer: piutang.byNormalizedCustomer,
  };
}

function writeCsv(file, rows, columns) {
  const lines = [columns.map(c => csvEscape(c.label)).join(',')];
  for (const row of rows) lines.push(columns.map(c => csvEscape(row[c.key])).join(','));
  fs.writeFileSync(file, lines.join('\n'));
}

(async () => {
  const startedAt = new Date().toISOString();
  try {
    const [dbInfo] = await sequelize.query('SELECT DATABASE() AS db, @@hostname AS host');
    const tableCounts = {};
    for (const t of ['penjualan_offline', 'penjualan_interior', 'invoice', 'invoice_interior', 'pembayaran_offline', 'pembayaran_interior', 'retur_offline', 'retur_sj_interior']) {
      tableCounts[t] = await safeCount(t);
    }

    const nameStats = await collectNameStats();
    const entries = await collectPiutangEntries();
    const piutang = summarizePiutang(entries);
    const productionEntries = entries.filter(e => Number(e.is_test || 0) === 0);
    const testingEntries = entries.filter(e => Number(e.is_test || 0) === 1);
    const productionPiutang = summarizeEntries('PRODUKSI_ONLY_IS_TEST_0', productionEntries);
    const testingPiutang = summarizeEntries('TESTING_ONLY_IS_TEST_1', testingEntries);
    const combinedPiutang = summarizeEntries('GABUNGAN_DIAGNOSTIK', entries);

    const summary = {
      generated_at: startedAt,
      db: dbInfo[0],
      table_counts: tableCounts,
      unique_names_total: nameStats.allNames.length,
      exact_duplicate_groups: nameStats.exactDuplicates.length,
      normalized_duplicate_groups: nameStats.normalizedDuplicates.length,
      similar_pairs: nameStats.similarPairs.length,
      production: {
        piutang_entry_count: productionPiutang.entry_count,
        total_debit: productionPiutang.total_debit,
        total_kredit: productionPiutang.total_kredit,
        net_saldo: productionPiutang.net_saldo,
        total_piutang: productionPiutang.total_piutang,
        total_lebih_bayar: productionPiutang.total_lebih_bayar,
        customers_with_piutang: productionPiutang.customers_with_piutang,
        customers_with_lebih_bayar: productionPiutang.customers_with_lebih_bayar,
      },
      testing: {
        piutang_entry_count: testingPiutang.entry_count,
        total_debit: testingPiutang.total_debit,
        total_kredit: testingPiutang.total_kredit,
        net_saldo: testingPiutang.net_saldo,
        total_piutang: testingPiutang.total_piutang,
        total_lebih_bayar: testingPiutang.total_lebih_bayar,
        customers_with_piutang: testingPiutang.customers_with_piutang,
        customers_with_lebih_bayar: testingPiutang.customers_with_lebih_bayar,
      },
      combined_diagnostic: {
        piutang_entry_count: combinedPiutang.entry_count,
        total_debit: combinedPiutang.total_debit,
        total_kredit: combinedPiutang.total_kredit,
        net_saldo: combinedPiutang.net_saldo,
        total_piutang: combinedPiutang.total_piutang,
        total_lebih_bayar: combinedPiutang.total_lebih_bayar,
      },
    };

    const report = {
      summary,
      all_names: nameStats.allNames,
      exact_duplicates: nameStats.exactDuplicates,
      normalized_duplicates: nameStats.normalizedDuplicates,
      similar_pairs: nameStats.similarPairs.slice(0, 200),
      production: {
        piutang_by_source_customer: productionPiutang.bySourceCustomer,
        piutang_by_normalized_customer_preview: productionPiutang.byNormalizedCustomer,
        piutang_entries_preview: productionEntries.slice(0, 500),
      },
      testing: {
        piutang_by_source_customer: testingPiutang.bySourceCustomer,
        piutang_by_normalized_customer_preview: testingPiutang.byNormalizedCustomer,
        piutang_entries_preview: testingEntries.slice(0, 500),
      },
      combined_diagnostic: {
        piutang_by_source_customer: piutang.bySourceCustomer,
        piutang_by_normalized_customer_preview: piutang.byNormalizedCustomer,
      },
      note: 'Audit read-only. Tidak ada perubahan database. Gunakan bagian production untuk laporan produksi. Saldo negatif dipisahkan sebagai lebih_bayar/uang_muka, bukan piutang minus.',
    };

    const docsDir = path.resolve(__dirname, '../../docs');
    fs.mkdirSync(docsDir, { recursive: true });
    const jsonPath = path.join(docsDir, 'audit-piutang-production.json');
    const csvPath = path.join(docsDir, 'audit-piutang-production-summary.csv');
    const namesCsvPath = path.join(docsDir, 'audit-piutang-production-names.csv');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    writeCsv(csvPath, productionPiutang.bySourceCustomer, [
      { key: 'sumber', label: 'Sumber' },
      { key: 'customer', label: 'Customer' },
      { key: 'debit', label: 'Debit' },
      { key: 'kredit', label: 'Kredit' },
      { key: 'saldo', label: 'Net Saldo' },
      { key: 'piutang', label: 'Piutang' },
      { key: 'lebih_bayar', label: 'Lebih Bayar/Uang Muka' },
      { key: 'count', label: 'Jumlah Mutasi' },
    ]);
    writeCsv(namesCsvPath, nameStats.allNames, [
      { key: 'sumber', label: 'Sumber' },
      { key: 'nama', label: 'Nama' },
      { key: 'total', label: 'Jumlah Transaksi' },
      { key: 'first_date', label: 'Tanggal Pertama' },
      { key: 'last_date', label: 'Tanggal Terakhir' },
      { key: 'test_rows', label: 'Jumlah Test' },
      { key: 'normalized', label: 'Normalisasi' },
    ]);

    console.log(JSON.stringify({ ok: true, summary, files: { jsonPath, csvPath, namesCsvPath } }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
