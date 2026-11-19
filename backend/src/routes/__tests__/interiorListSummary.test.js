const { models, route, invoke, respond } = require('../../../tests/financeFixture.cjs');
const { Op } = require('sequelize');
const sale = (id = 1) => ({ id, nama_customer: 'Customer', no_po: `PO-${id}`, nama_pt_npwp: 'PT Customer', status: 'ACTIVE', faktur: 'FAKTUR', is_test: 0,
  tanggal: '2026-11-01', pakai_ppn: 1, ppn_persen: 11, items: [{ id, qty: 10, harga_satuan: 100000, subtotal: 1000000 }] });
const invoice = (p, extra = {}) => ({ id: p.id, penjualan_interior_id: p.id, tanggal: '2026-11-02', nomor_invoice: `INV-${p.id}`, penjualan: p, ...extra });
function fixture(projects) {
  const m = models();
  m.PenjualanInterior.findAll = async () => projects;
  m.PenjualanInterior.findAndCountAll = async () => ({ count: projects.length, rows: projects });
  return m;
}

test('list total excludes unbilled/ordinary-Proforma projects but keeps them in operational list', async () => {
  const projects = [sale(1), sale(2)], m = fixture(projects);
  m.InvoiceInterior.findAll = async () => [invoice(projects[0])];
  m.ProformaInvoice.findAll = async () => [{ id: 2, penjualan_interior_id: 2, tanggal: '2026-11-02', nomor_sub_invoice: null,
    total: 1110000, terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]', penjualan: projects[1] }];
  const result = await invoke(route('penjualanInterior', m), '/');
  expect(result.summary.totalNilai).toBe(1000000);
  expect(result.summary).toEqual({ totalNilai: 1000000, totalPpn: 110000, totalTagihan: 1110000 });
  expect(result.total).toBe(2); expect(result.data).toHaveLength(2);
});

test('ordinary Proforma without Invoice or numbered Sub-Invoice contributes zero', async () => {
  const p = sale(), m = fixture([p]);
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: '', total: 1110000,
    terms: '[{"tipe":"DP","persen":30}]', penjualan: p }];
  expect((await invoke(route('penjualanInterior', m), '/')).summary).toEqual({ totalNilai: 0, totalPpn: 0, totalTagihan: 0 });
});

test('numbered Sub-Invoice counts only its installment before VAT, not Proforma whole-project total', async () => {
  const p = sale(), m = fixture([p]);
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: 'SUB-1', total: 1110000,
    terms: '[{"tipe":"DP","persen":30}]', penjualan: p }];
  expect((await invoke(route('penjualanInterior', m), '/')).summary).toEqual({ totalNilai: 300000, totalPpn: 33000, totalTagihan: 333000 });
});

test('Sub-Invoice followed by shipment invoice is not counted twice', async () => {
  const p = sale(), m = fixture([p]);
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: 'SUB-1',
    terms: '[{"tipe":"DP","persen":30}]', penjualan: p }];
  m.InvoiceInterior.findAll = async () => [invoice(p)];
  expect((await invoke(route('penjualanInterior', m), '/')).summary).toEqual({ totalNilai: 1000000, totalPpn: 110000, totalTagihan: 1110000 });
});

test('partial shipment includes only invoiced goods and proportional costs, before VAT', async () => {
  const p = { ...sale(), biaya_assembly: 100000, biaya_kirim: 200000 }, m = fixture([p]);
  m.InvoiceInterior.findAll = async () => [invoice(p, { surat_jalan_interior_id: 1 })];
  m.SuratJalanInterior.findAll = async () => [{ id: 1, items: [{ item: p.items[0], qty_kirim: 4 }] }];
  expect((await invoke(route('penjualanInterior', m), '/')).summary.totalNilai).toBe(520000);
});

test('summary covers all matching projects, not just current page, regardless of payment', async () => {
  const projects = [sale(1), sale(2)], m = fixture(projects);
  m.InvoiceInterior.findAll = async () => projects.map(p => invoice(p));
  m.PembayaranInterior.findAll = async () => { throw Error('Payments must not affect or block invoice sales summary'); };
  m.PenjualanInterior.findAndCountAll = async () => ({ count: 2, rows: [projects[1]] });
  const result = await invoke(route('penjualanInterior', m), '/', { page: 2, limit: 1 });
  expect(result.summary.totalNilai).toBe(2000000); expect(result.data).toHaveLength(1);
});

test('existing project filters are preserved and matched IDs scope invoice query before item loading', async () => {
  const p = sale(), m = fixture([p]); let metadata, invoiceQuery, pageQuery;
  m.PenjualanInterior.findAll = async options => { metadata = options; return [p]; };
  m.PenjualanInterior.findAndCountAll = async options => { pageQuery = options; return { count: 1, rows: [p] }; };
  m.InvoiceInterior.findAll = async options => { invoiceQuery = options; return [invoice(p)]; };
  const q = { search: 'PT Customer', faktur: 'FAKTUR', status: 'ACTIVE', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-19' };
  const result = await invoke(route('penjualanInterior', m), '/', q);
  expect(result.summary.totalNilai).toBe(1000000);
  expect(metadata.attributes).toEqual(['id']); expect(metadata.include).toBeUndefined();
  expect(metadata.where).toEqual(pageQuery.where);
  expect(metadata.where[Op.or][2].nama_pt_npwp[Op.like]).toBe('%PT Customer%');
  expect(invoiceQuery.include[0].where[Op.and][0].id[Op.in]).toEqual([1]);
  expect(invoiceQuery.include[0].where.is_test).toBe(0);
  expect(invoiceQuery.where.tanggal[Op.lte]).toBe('2026-11-19');
});

test('empty filtered list does not load unrelated invoice history', async () => {
  const m = fixture([]);
  m.InvoiceInterior.findAll = async () => { throw Error('Unrelated invoice query'); };
  expect((await invoke(route('penjualanInterior', m), '/')).summary).toEqual({ totalNilai: 0, totalPpn: 0, totalTagihan: 0 });
});

test('invalid date range is rejected before querying projects', async () => {
  const m = models(); m.PenjualanInterior.findAll = async () => { throw Error('Unexpected query'); };
  expect((await respond(route('penjualanInterior', m), '/', { tanggal_dari: '2026-11-19', tanggal_sampai: '2026-11-01' })).code).toBe(400);
});

test('non-taxed nominal Sub-Invoice uses its issued amount, not whole project or percentage label', async () => {
  const p = { ...sale(), pakai_ppn: 0, ppn_persen: null }, m = fixture([p]);
  m.ProformaInvoice.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: 'SUB-1',
    total: 1000000, terms: '[{"tipe":"DP","persen":30,"jumlah":250000}]', penjualan: p }];
  expect((await invoke(route('penjualanInterior', m), '/')).summary).toEqual({ totalNilai: 250000, totalPpn: 0, totalTagihan: 250000 });
});

test('future invoice does not contribute before the selected cutoff', async () => {
  const p = sale(), m = fixture([p]);
  m.InvoiceInterior.findAll = async () => [invoice(p, { tanggal: '2026-11-20' })];
  expect((await invoke(route('penjualanInterior', m), '/', { tanggal_sampai: '2026-11-19' })).summary.totalNilai).toBe(0);
});

test('invoice load scopes to matched project IDs and does not widen existing customer filters', async () => {
  const { createInvoiceBasis } = require('../../utils/invoiceBasis');
  const m = models(); let where;
  m.PenjualanInterior.findAll = async () => [{ id: 1, nama_customer: 'Customer', faktur: 'FAKTUR' }];
  m.InvoiceInterior.findAll = async options => { where = options.include[0].where; return []; };
  await createInvoiceBasis(m).load({ source: 'INTERIOR', isTest: 1, scope: { customer_key: 'INTERIOR:FAKTUR:customer', saleIds: [2] }, withPayments: false });
  expect(where.is_test).toBe(1);
  expect(where.id[Op.in]).toEqual([1]);
  expect(where[Op.and][0].id[Op.in]).toEqual([2]);
});

test('TEST role scopes project metadata, invoice parent and page to test records', async () => {
  const p = { ...sale(), is_test: 1 }, m = fixture([p]), scopes = [];
  m.PenjualanInterior.findAll = async options => { scopes.push(options.where.is_test); return [p]; };
  m.PenjualanInterior.findAndCountAll = async options => { scopes.push(options.where.is_test); return { count: 1, rows: [p] }; };
  m.InvoiceInterior.findAll = async options => { scopes.push(options.include[0].where.is_test); return [invoice(p)]; };
  const router = route('penjualanInterior', m), handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.get).route.stack.at(-1).handle;
  const res = { json(body) { this.body = body; return this; }, status(code) { this.code = code; return this; } };
  await handler({ query: {}, user: { role: 'TEST' } }, res);
  expect(res.body.summary.totalNilai).toBe(1000000);
  expect(scopes).toEqual([1, 1, 1]);
});
