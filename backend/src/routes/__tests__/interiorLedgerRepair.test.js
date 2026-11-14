const { models, route, invoke, respond } = require('../../../tests/financeFixture.cjs');
const sale = { id: 1, nama_customer: 'Customer', faktur: 'FAKTUR', pakai_ppn: 0,
  items: [{ id: 1, qty: 5, harga_satuan: 20000, subtotal: 100000 }] };
const invoice = (extra = {}) => ({ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-30', nomor_invoice: 'INV', penjualan: sale, ...extra });
const payment = (extra = {}) => ({ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-05', tipe: 'PELUNASAN_PENUH', jumlah: 100000, penjualan: sale, ...extra });

test('zero closing balance agrees between summary and last detail row', async () => {
  const m = models();
  m.InvoiceInterior.findAll = async () => [invoice()];
  m.PembayaranInterior.findAll = async () => [payment()];
  const r = route('piutangUsaha', m), q = { sumber: 'INTERIOR', from: '2026-11-01', to: '2026-11-10' };
  const summary = await invoke(r, '/rekap', q), detail = await invoke(r, '/detail', q);
  expect(summary.summary.saldoAkhir).toBe(0);
  expect(detail.summary.saldoAkhir).toBe(0);
  expect(detail.data.at(-1).saldo).toBe(0);
});

test.each([false, true])('logistics return never creates customer credit (billed=%s)', async billed => {
  const m = models();
  if (billed) {
    m.InvoiceInterior.findAll = async () => [invoice()];
    m.PembayaranInterior.findAll = async () => [payment()];
  }
  m.ReturSJInterior.findAll = async () => [{ id: 1, tanggal: '2026-11-06', qty_retur: 5,
    item: { ...sale.items[0], penjualan_interior_id: 1, penjualan: sale } }];
  const r = route('piutangUsaha', m);
  const result = await invoke(r, '/rekap', { sumber: 'INTERIOR' });
  expect(result.summary.saldoAkhir).toBe(0);
  expect(result.summary.lebihBayar).toBe(0);
  const journal = await invoke(route('transaksi', m), '/', { sumber: 'INTERIOR' });
  expect(journal.data.filter(row => row.jenis === 'RETUR')).toEqual([]);
  const advance = await invoke(r, '/uang-muka-interior');
  expect(advance.summary.sisa).toBe(0);
});

test('logistics return does not discount project summary or row', async () => {
  const m = models();
  const p = { ...sale, pembayarans: [{ jumlah: 100000 }] };
  m.InvoiceInterior.findAll = async () => [invoice({ penjualan: p })];
  m.PenjualanInterior.findAll = async () => [p];
  m.PenjualanInterior.findAndCountAll = async () => ({ count: 1, rows: [p] });
  m.ReturSJInterior.findAll = async () => [{ penjualan_interior_item_id: 1, total_retur: 5 }];
  const result = await invoke(route('keuangan', m), '/interior');
  expect(result.summary.totalNilaiProyek).toBe(100000);
  expect(result.list[0].grandTotal).toBe(100000);
});

test.each([
  { from: '2026-11-10', to: '2026-11-01' }, { from: '10/11/2026' },
  { from: '2026-02-31' }, { to: '2025-02-29' }, { from: ['2026-11-01'] },
])('rejects invalid range before any database access: %j', async query => {
  const m = models();
  for (const model of Object.values(m)) if (model.findAll) model.findAll = async () => { throw Error('Database accessed'); };
  for (const url of ['/rekap', '/detail', '/uang-muka-interior']) {
    const result = await respond(route('piutangUsaha', m), url, query);
    expect(result.code).toBe(400);
    expect(result.body.message).toMatch(/Tanggal/);
  }
});

test('leap date is valid, no lower bound discards opening invoices', async () => {
  const m = models(); let options;
  m.InvoiceInterior.findAll = async o => { options = o; return [invoice()]; };
  const result = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR', from: '2028-02-29', to: '2028-03-01' });
  expect(result.summary.saldoAwal).toBe(100000);
  expect(Object.getOwnPropertySymbols(options.where.tanggal)).toHaveLength(1);
});

test('one shipment query serves many invoices without caching across requests', async () => {
  const m = models(); let calls = 0;
  m.InvoiceInterior.findAll = async () => [invoice({ surat_jalan_interior_id: 1 }), invoice({ id: 2, surat_jalan_interior_id: 2 })];
  m.SuratJalanInterior.findAll = async () => { calls++; return [1, 2].map(id => ({ id, items: [{ qty_kirim: 1, item: sale.items[0] }] })); };
  const r = route('piutangUsaha', m);
  expect((await invoke(r, '/rekap', { sumber: 'INTERIOR' })).summary.debit).toBe(40000);
  expect(calls).toBe(1);
  await invoke(r, '/rekap', { sumber: 'INTERIOR' });
  expect(calls).toBe(2);
});

function redeliveryFixture() {
  const m = models(), returns = [], documents = [], lines = [];
  let delivered = 5;
  const locks = [];
  m.sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} });
  m.PenjualanInterior.findByPk = async () => ({ ...sale, update: async () => {} });
  m.SuratJalanInterior.findOne = async options => { locks.push(options.lock); return { id: 1 }; };
  m.SuratJalanInteriorItem.findOne = async () => ({ qty_kirim: 5 });
  m.SuratJalanInterior.count = async () => 1;
  m.ReturSJInterior.findAll = async () => returns;
  m.ReturSJInterior.create = async row => { returns.push(row); return row; };
  m.SuratPengantarInterior = {
    findAll: async () => documents.map(doc => ({ ...doc, items: lines.filter(l => l.surat_pengantar_interior_id === doc.id) })),
    create: async row => { const doc = { id: documents.length + 1, ...row }; documents.push(doc); return doc; },
  };
  m.SuratPengantarInteriorItem = { create: async row => { lines.push(row); return row; } };
  m.PenjualanInteriorItem.findByPk = async () => sale.items[0];
  m.PenjualanInteriorItem.findAll = async () => [{ ...sale.items[0], sudah_kirim: delivered }];
  m.PenjualanInteriorItem.increment = async (_, o) => { delivered += Number(o.by); };
  m.PenjualanInteriorItem.decrement = async (_, o) => { delivered -= Number(o.by); };
  return { m, returns, documents, lines, locks, delivered: () => delivered };
}

test('redelivery subtracts earlier SP quantities, rejects duplicates and supports another return cycle', async () => {
  const f = redeliveryFixture(), r = route('penjualanInterior', f.m);
  const send = { surat_jalan_interior_id: 1, tanggal: '2026-11-10' };
  const back = { ...send, items: [{ penjualan_interior_item_id: 1, qty_retur: 5 }] };
  expect((await respond(r, '/:id/retur-sj', {}, back, 'post')).code).toBe(201);
  expect(f.delivered()).toBe(0);
  expect((await respond(r, '/:id/sp-from-retur', {}, send, 'post')).code).toBe(201);
  expect((await respond(r, '/:id/sp-from-retur', {}, send, 'post')).code).toBe(400);
  expect(f.delivered()).toBe(5);
  expect(f.documents).toHaveLength(1);
  expect((await respond(r, '/:id/retur-sj', {}, back, 'post')).code).toBe(201);
  expect((await respond(r, '/:id/sp-from-retur', {}, send, 'post')).code).toBe(201);
  expect(f.delivered()).toBe(5);
  expect(f.documents).toHaveLength(2);
  expect(f.locks.every(lock => lock === 'UPDATE')).toBe(true);
});

test('redelivery only sends the unsent remainder for each item', async () => {
  const f = redeliveryFixture();
  f.returns.push({ penjualan_interior_item_id: 1, qty_retur: '5' });
  f.documents.push({ id: 1 });
  f.lines.push({ surat_pengantar_interior_id: 1, penjualan_interior_item_id: 1, qty: 3 });
  const result = await respond(route('penjualanInterior', f.m), '/:id/sp-from-retur', {}, { surat_jalan_interior_id: 1, tanggal: '2026-11-10' }, 'post');
  expect(result.code).toBe(201);
  expect(f.lines.at(-1).qty).toBe(2);
});

test('invoice per-item VAT remains authoritative, not historical payments or ordinary proformas', async () => {
  const m = models();
  const p = { ...sale, pakai_ppn: 1, ppn_persen: 11, items: [{ qty: 100, harga_satuan: 146088, subtotal: 14608800 }] };
  m.InvoiceInterior.findAll = async () => [invoice({ penjualan: p })];
  m.PembayaranInterior.findAll = async () => [payment({ penjualan: p, jumlah: 16215768 })];
  m.ProformaInvoice.findAll = async () => [{ penjualan: p, total: 16215768, nomor_sub_invoice: null }];
  const result = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR' });
  expect(result.summary.saldoAkhir).toBe(32);
});

test('selected customer scopes all project history and faktur before loading monetary items', async () => {
  const m = models(), { Op } = require('sequelize'); let include;
  m.PenjualanInterior.findAll = async () => [{ id: 1, nama_customer: '  CUSTOMER  ', faktur: 'FAKTUR' }, { id: 2, nama_customer: 'Other', faktur: 'FAKTUR' }, { id: 3, nama_customer: 'Customer', faktur: 'FAKTUR' }];
  m.InvoiceInterior.findAll = async options => { include = options.include[0]; return [invoice()]; };
  const result = await invoke(route('piutangUsaha', m), '/detail', { sumber: 'INTERIOR', faktur: 'FAKTUR', customer_key: 'INTERIOR:FAKTUR:customer', from: '2026-11-01' });
  expect(include.where.id[Op.in]).toEqual([1, 3]);
  expect(include.where.faktur).toBe('FAKTUR');
  expect(result.summary.saldoAwal).toBe(100000);
});

test('search by invoice reference retains all matching customer history, not just that invoice', async () => {
  const m = models();
  m.InvoiceInterior.findAll = async () => [invoice(), invoice({ id: 2, nomor_invoice: 'OTHER' })];
  m.PembayaranInterior.findAll = async () => [payment()];
  const result = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR', search: 'INV' });
  expect(result.summary.debit).toBe(200000);
  expect(result.summary.kredit).toBe(100000);
});

test('large shipment sets use bounded batches and preserve every invoice amount', async () => {
  const { Op } = require('sequelize');
  const { createInteriorFinance } = require('../../utils/interiorFinance');
  const sizes = [];
  const finance = createInteriorFinance({ SuratJalanInterior: { findAll: async options => {
    const ids = options.where.id[Op.in]; sizes.push(ids.length);
    return ids.map(id => ({ id, items: [{ qty_kirim: 1, item: sale.items[0] }] }));
  } } });
  const invoices = Array.from({ length: 1001 }, (_, i) => invoice({ id: i + 1, surat_jalan_interior_id: i + 1 }));
  const amount = await finance.prepareInvoiceAmounts(invoices);
  const values = await Promise.all(invoices.map(amount));
  expect(sizes).toEqual([500, 500, 1]);
  expect(values.reduce((n, value) => n + value.total, 0)).toBe(20000 * 1001);
});
