const { models, route, invoke, respond } = require('../../../tests/financeFixture.cjs');
const sale = () => ({ id: 1, tipe: 'PENJUALAN', status: 'ACTIVE', faktur: 'FAKTUR', tanggal: '2026-01-10', nama_penerima: 'Customer', nama_customer: 'Customer', pakai_ppn: 0,
  items: [{ id: 1, qty: 1, harga_satuan: 100000, subtotal: 100000 }], pembayarans: [], invoices: [], suratJalans: [] });

test('Interior outstanding sums positive balances instead of offsetting other projects', async () => {
  const m = models();
  const rows = [{ ...sale(), pembayarans: [{ jumlah: 200000, tipe: 'DP' }] }, { ...sale(), id: 2 }];
  m.PenjualanInterior.findAll = async () => rows;
  m.PenjualanInterior.findAndCountAll = async () => ({ count: 2, rows });
  const res = await invoke(route('keuangan', m), '/interior');
  expect(res.summary.totalOutstanding).toBe(100000);
  expect(res.summary.totalOutstanding).toBe(res.list.reduce((n, r) => n + r.sisa, 0));
});

test('Display unpaid card and row both subtract payments and include invoice VAT', async () => {
  const m = models();
  const p = { ...sale(), display_source_id: 9, pembayarans: [{ jumlah: 40000 }], invoices: [{ id: 1, tanggal: '2026-01-10', ppn_persen: 11 }] };
  const display = { ...sale(), id: 9, tipe: 'DISPLAY', items: [], suratPengantars: [{ id: 1, tanggal: '2026-01-10' }] };
  m.PenjualanOfflineItem.findAll = async () => p.items;
  m.PenjualanOffline.findAll = async opts => opts.where.tipe === 'DISPLAY' ? [] : [p];
  m.PenjualanOffline.findAndCountAll = async () => ({ count: 1, rows: [display] });
  const res = await invoke(route('keuangan', m), '/offline', { tab: 'display' });
  expect(res.summary.totalDisplayBelumLunas).toBe(71000);
  expect(res.list[0].nilaiTerjualBelumLunas).toBe(71000);
});

test('same-day incoming advance remains after earlier same-day invoice usage', async () => {
  const m = models(); const p = sale();
  m.InvoiceInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-01-11', nomor_invoice: 'INV', surat_jalan_interior_id: 1, penjualan: p }];
  m.SuratJalanInterior.findAll = async () => [{ items: [{ qty_kirim: 1, item: { qty: 1, harga_satuan: 50000, subtotal: 50000 } }] }];
  m.PembayaranInterior.findAll = async () => [
    { id: 1, penjualan_interior_id: 1, tanggal: '2026-01-10', jumlah: 100000, tipe: 'DP', penjualan: p },
    { id: 2, penjualan_interior_id: 1, tanggal: '2026-01-11', jumlah: 100000, tipe: 'DP', penjualan: p },
  ];
  const router = route('piutangUsaha', m);
  const res = await invoke(router, '/uang-muka-interior');
  expect(res.data[0]).toMatchObject({ uang_muka_masuk: 200000, uang_muka_terpakai: 50000, sisa_uang_muka: 150000 });
  const cutoff = await invoke(router, '/uang-muka-interior', { to: '2026-01-10' });
  expect(cutoff.data[0].sisa_uang_muka).toBe(100000);
});

test.each(['/rekap', '/detail'])('historical %s retains invoice before later reissue', async endpoint => {
  const m = models(); const p = sale();
  m.Invoice.findAll = async () => [1, 2].map(id => ({ id, penjualan_offline_id: 1, tanggal: `2026-0${id}-10`, nomor_invoice: `INV-${id}`, penjualan: p }));
  const res = await invoke(route('piutangUsaha', m), endpoint, { sumber: 'OFFLINE', to: '2026-01-31' });
  expect(res.summary.debit).toBe(100000);
});

test('Online FAKTUR uses stored faktur filter in All Sales', async () => {
  const m = models(); const queries = [];
  m.sequelize.query = async (sql, opts) => { queries.push({ sql, opts }); return sql.includes('summary_combined') ? [{ totalNilai: 0 }] : sql.includes('AS combined') ? [{ total: 0 }] : []; };
  await invoke(route('penjualan', m), '/semua', { sumber: 'ONLINE', faktur: 'FAKTUR' });
  expect(queries[0].sql).not.toContain('1 = 0');
  expect(queries[0].opts.replacements).toContain('FAKTUR');
});

test('new Offline VAT invoice reopens underpaid sale and notifies finance', async () => {
  const m = models(); const p = { ...sale(), status: 'COMPLETED', is_test: 0, pembayarans: [{ jumlah: 100000 }] };
  p.update = async data => Object.assign(p, data);
  m.PenjualanOffline.findByPk = async () => p;
  m.Invoice.create = async data => { const inv = { id: 1, ...data }; p.invoices.push(inv); return inv; };
  await invoke(route('penjualanOffline', m), '/:id/invoice', {}, { tanggal: '2026-01-10', jatuh_tempo: '2026-01-24', ppn_persen: 11 }, 'post');
  expect(p.status).toBe('ACTIVE');
  expect(m.__events.some(e => e[0] === 'penjualan-offline-list')).toBe(true);
});

test('Interior return rejects cumulative overflow, including repeated items, and emits refresh', async () => {
  const m = models(); const p = sale(); const stored = []; let delivered = 5;
  m.sequelize = { transaction: async () => ({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} }) };
  m.PenjualanInterior.findByPk = async () => ({ ...p, update: async () => {} });
  m.SuratJalanInterior.findOne = async () => ({ id: 1 });
  m.SuratJalanInterior.count = async () => 1;
  m.SuratJalanInteriorItem.findOne = async () => ({ qty_kirim: 5 });
  m.PenjualanInteriorItem.findAll = async () => [{ qty: 5, harga_satuan: 100000, subtotal: 500000, sudah_kirim: delivered }];
  m.ReturSJInterior.findAll = async () => stored;
  m.ReturSJInterior.create = async row => { stored.push(row); return row; };
  m.PenjualanInteriorItem.decrement = async (_, options) => { delivered -= options.by; };
  const r = route('penjualanInterior', m);
  const body = { surat_jalan_interior_id: 1, tanggal: '2026-01-10', items: [{ penjualan_interior_item_id: 1, qty_retur: 3 }] };
  expect((await respond(r, '/:id/retur-sj', {}, body, 'post')).code).toBe(201);
  expect((await respond(r, '/:id/retur-sj', {}, body, 'post')).code).toBe(400);
  expect(delivered).toBe(2);
  expect(m.__events.some(e => e[0] === 'penjualan-interior-list')).toBe(true);
});

test('Proforma alone is not debt; numbered Sub-Invoice is posted once in ledger and journal', async () => {
  const m = models(); const p = sale();
  let numbered = false;
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, nomor_sub_invoice: numbered ? 'SUB-1' : null, tanggal: '2026-01-10', terms: '[{"tipe":"DP","persen":30}]', penjualan: p }];
  let ledger = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR' });
  expect(ledger.summary.debit).toBe(0);
  numbered = true;
  ledger = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR' });
  const journal = await invoke(route('transaksi', m), '/');
  expect(ledger.summary.debit).toBe(30000);
  expect(journal.summary.totalInvoice).toBe(30000);
});

test('shipment and full-settlement Sub-Invoice do not double journal revenue', async () => {
  const m = models(); const p = sale();
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, nomor_sub_invoice: 'SUB-1', tanggal: '2026-01-10', terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]', penjualan: p }];
  m.InvoiceInterior.findAll = async () => [{ id: 2, penjualan_interior_id: 1, nomor_invoice: 'INV-2', tanggal: '2026-01-11', penjualan: p }];
  const res = await invoke(route('transaksi', m), '/');
  expect(res.summary.totalInvoice).toBe(100000);
  expect(res.data.every(r => r.balanced)).toBe(true);
});

test('Offline reissued invoices count once in journal, with historical cutoff', async () => {
  const m = models(); const p = sale();
  m.Invoice.findAll = async () => [1, 2].map(id => ({ id, penjualan_offline_id: 1, tanggal: `2026-0${id}-10`, nomor_invoice: `INV-${id}`, penjualan: p }));
  const router = route('transaksi', m);
  expect((await invoke(router, '/')).summary.totalInvoice).toBe(100000);
  expect((await invoke(router, '/', { to: '2026-01-31' })).summary.totalInvoice).toBe(100000);
});

test('Interior DP is advance liability until invoice uses it; original payment counted once', async () => {
  const m = models(); const p = sale();
  m.PembayaranInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-01-09', tipe: 'DP', jumlah: 100000, penjualan: p }];
  const r = route('transaksi', m);
  let res = await invoke(r, '/');
  expect(res.data.flatMap(t => t.lines).filter(l => l.account_code === '1201').reduce((n, l) => n + l.kredit, 0)).toBe(0);
  expect(res.data.flatMap(t => t.lines).some(l => l.account_code === '2102' && l.kredit === 100000)).toBe(true);
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, nomor_sub_invoice: 'SUB-1', tanggal: '2026-01-10', terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]', penjualan: p }];
  res = await invoke(r, '/');
  expect(res.summary.totalPembayaran).toBe(100000);
  expect(res.data.some(t => t.jenis === 'UANG_MUKA_TERPAKAI')).toBe(true);
  expect(res.data.every(t => t.balanced)).toBe(true);
});

test('Online journal is isolated from unrelated sources and records gateway payments, not bank settlement', async () => {
  const m = models();
  for (const name of ['Invoice', 'PembayaranOffline', 'ReturOffline', 'InvoiceInterior', 'PembayaranInterior', 'ReturSJInterior', 'ProformaInvoice']) {
    m[name].findAll = async () => { throw Error('Unrelated ledger must not be queried'); };
  }
  const p = { ...sale(), status: 'SELESAI', nama_pelanggan: 'Customer', id_pesanan: 'ORDER', pendapatan_bersih: 80000 };
  m.InvoiceOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-01-10', nomor_invoice: 'INV', penjualan: p }];
  m.PembayaranOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-01-10', jumlah: 100000, penjualan: p }];
  const res = await invoke(route('transaksi', m), '/', { sumber: 'ONLINE' });
  expect(res.summary.totalInvoice).toBe(100000);
  expect(res.summary.totalPembayaran).toBe(100000);
  expect(res.data.every(r => r.sumber === 'ONLINE' && r.balanced)).toBe(true);
  expect(res.data.flatMap(r => r.lines).some(l => l.account_code === '1106' && l.debit === 100000)).toBe(true);
  expect(res.data.flatMap(r => r.lines).some(l => l.account_code === '1102')).toBe(false);
});

test('historical Display SP selection excludes later reissues', () => {
  const { selectLatestDisplaySps } = route('piutangUsaha', models()).__testables;
  const result = selectLatestDisplaySps([{ id: 1, penjualan_offline_id: 9, tanggal: '2026-01-10' }, { id: 2, penjualan_offline_id: 9, tanggal: '2026-02-10' }], '2026-01-31');
  expect(result.map(row => row.id)).toEqual([1]);
});

test('Display server search applies customer/SP conditions before pagination without disabling subqueries', async () => {
  const m = models(); const { Op } = require('sequelize'); let query;
  m.SuratPengantar.findAll = async () => [{ penjualan_offline_id: 9 }];
  m.PenjualanOffline.findAndCountAll = async opts => { query = opts; return { count: 0, rows: [] }; };
  await invoke(route('keuangan', m), '/offline', { tab: 'display', search: 'SP-9', page: 2, limit: 20 });
  expect(query.where[Op.or][0].nama_penerima[Op.like]).toBe('%SP-9%');
  expect(query.where[Op.or][1].id[Op.in]).toEqual([9]);
  expect(query.offset).toBe(20);
  expect(query.subQuery).not.toBe(false);
});

test.each(['post', 'patch'])('Proforma %s rejects invalid terms before saving and accepts exact nominal-only terms', async method => {
  const m = models(); const p = { ...sale(), update: async () => {} }; const writes = [];
  m.PenjualanInterior.findByPk = async () => p;
  m.ProformaInvoice.findOne = async () => ({ penjualan: p, update: async row => writes.push(row) });
  m.ProformaInvoice.create = async row => { writes.push(row); return { id: 1, ...row }; };
  const router = route('penjualanInterior', m);
  const url = method === 'post' ? '/:id/proforma' : '/:id/proforma/:proformaId';
  const invalid = await respond(router, url, {}, { terms: [{ tipe: 'DP', jumlah: 0, persen: 30 }] }, method);
  expect(invalid.code).toBe(400);
  expect(writes).toHaveLength(0);
  const valid = await respond(router, url, {}, { terms: [{ tipe: 'DP', jumlah: 1, persen: 0 }] }, method);
  expect(valid.code).toBeLessThan(400);
  expect(JSON.parse(writes[0].terms)).toEqual([{ tipe: 'DP', jumlah: 1, persen: 0 }]);
});
