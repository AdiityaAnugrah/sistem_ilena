const path = require('path');
const { invoiceFixture } = require('../../../tests/invoiceFixture.cjs');
const root = path.resolve(__dirname, '../../../..');

describe('create Interior with optional costs', () => {
  const create = async body => {
    const fixture = invoiceFixture(root, 'penjualanInterior');
    fixture.models.PenjualanInteriorItem.bulkCreate = async () => {};
    const response = await fixture.call('post', '/', { faktur: 'NON_FAKTUR', no_po: 'PO-FIXTURE', nama_customer: 'Fixture', items: [{ qty: 1, harga_satuan: 1000000 }], ...body });
    return response;
  };
  test('persists both costs', async () => {
    const result = await create({ biaya_assembly: '100000', biaya_kirim: '200000' });
    expect(result.status).toBe(201);
    expect(result.writes[0]).toMatchObject({ biaya_assembly: 100000, biaya_kirim: 200000 });
  });
  test('omitted costs remain NULL', async () => {
    const result = await create({});
    expect(result.status).toBe(201);
    expect(result.writes[0]).toMatchObject({ biaya_assembly: null, biaya_kirim: null });
  });
  test.each([{ biaya_assembly: -1 }, { biaya_kirim: 'abc' }, { biaya_assembly: 1000000000 }])('invalid cost rejected before saving %j', async body => {
    const result = await create(body);
    expect(result.status).toBe(400);
    expect(result.writes).toEqual([]);
  });
});

describe('Interior print/email normalized costs', () => {
  test.each(['print', 'email'])('%s uses the same partial-shipment cost share', async type => {
    let normalized;
    const fixture = invoiceFixture(root, 'dokumen', { imports: {
      '../utils/htmlGenerator': { generateHTMLInvoice: data => { normalized = data; return 'HTML-FIXTURE'; } },
      '../utils/htmlToPdf': { htmlToPdf: async () => Buffer.from('PDF-FIXTURE') },
      '../utils/mailer': { sendDocumentEmail: async () => {} },
    } });
    const sale = { nama_customer: 'Fixture', pakai_ppn: 0, biaya_assembly: 100000, biaya_kirim: 200000, items: [{ qty: 2, subtotal: 1000000, harga_satuan: 500000 }] };
    const invoice = { nomor_invoice: 'INV-FIXTURE', tanggal: '2026-10-30', penjualan_interior_id: 1, surat_jalan_ids: '[1]', penjualan: sale };
    fixture.models.InvoiceInterior.findByPk = async () => ({ toJSON: () => invoice });
    fixture.models.SuratJalanInterior.findAll = async () => [{ nomor_surat: 'SJ-FIXTURE', items: [{ qty_kirim: 1, item: { qty: 2, subtotal: 1000000, harga_satuan: 500000 } }] }];
    const result = await fixture.call(type === 'print' ? 'get' : 'post', `/invoice-interior/:id/${type}`, { email: 'fixture@example.test' });
    expect(result.status).toBe(200);
    expect(normalized.penjualan).toMatchObject({ biaya_assembly: 50000, biaya_kirim: 100000 });
  });
});

describe('Interior payment and reports stay consistent', () => {
  const sale = { id: 1, nama_customer: 'Fixture', no_po: 'PO-FIXTURE', faktur: 'NON_FAKTUR', status: 'ACTIVE', pakai_ppn: 0, biaya_assembly: 100000, biaya_kirim: 200000, items: [{ id: 1, qty: 1, subtotal: 1000000, sudah_kirim: 1 }], pembayarans: [], update: async () => {} };
  test('full payment accepts the goods plus both costs', async () => {
    const fixture = invoiceFixture(root, 'penjualanInterior');
    fixture.models.PenjualanInterior.findByPk = async () => sale;
    fixture.models.sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
    const result = await fixture.call('post', '/:id/pembayaran', { tipe: 'PELUNASAN_PENUH', jumlah: 1300000 });
    expect(result.status).toBe(201);
    expect(result.writes[0].jumlah).toBe(1300000);
  });
  test('Piutang Interior debit includes the optional costs', async () => {
    const fixture = invoiceFixture(root, 'piutangUsaha');
    fixture.models.InvoiceInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-30', nomor_invoice: 'INV-FIXTURE', penjualan: sale }];
    const result = await fixture.call('get', '/rekap');
    expect(result.status).toBe(200);
    expect(result.body.data[0].debit).toBe(1300000);
  });
  test('finance summary and list include the same costs', async () => {
    const fixture = invoiceFixture(root, 'keuangan');
    fixture.models.sequelize.fn = (...args) => args;
    fixture.models.sequelize.col = name => name;
    fixture.models.PenjualanInterior.findAll = async () => [sale];
    fixture.models.PenjualanInterior.findAndCountAll = async () => ({ count: 1, rows: [sale] });
    const result = await fixture.call('get', '/interior');
    expect(result.status).toBe(200);
    expect(result.body.summary.totalNilaiProyek).toBe(1300000);
    expect(result.body.list[0].grandTotal).toBe(1300000);
  });
  test('journal stays balanced with costs in Interior revenue', async () => {
    const fixture = invoiceFixture(root, 'transaksi');
    fixture.models.ChartOfAccount.findOrCreate = async () => [{}];
    fixture.models.InvoiceInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-30', nomor_invoice: 'INV-FIXTURE', penjualan: sale }];
    const result = await fixture.call('get', '/');
    expect(result.status).toBe(200);
    const row = result.body.data.find(item => item.sumber === 'INTERIOR' && item.jenis === 'INVOICE');
    expect(row.nilai).toBe(1300000);
    expect(row.balanced).toBe(true);
  });
});
