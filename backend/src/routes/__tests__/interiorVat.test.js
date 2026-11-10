const path = require('path');
const { invoiceFixture } = require('../../../tests/invoiceFixture.cjs');
const root = path.resolve(__dirname, '../../../..');
const item = { id: 1, qty: 3, harga_satuan: 10005, subtotal: 30015, sudah_kirim: 3 };
const sale = { id: 1, nama_customer: 'Fixture', no_po: 'FIXTURE', faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11, status: 'ACTIVE', items: [item], pembayarans: [], update: async () => {} };

test('detail shows a corrected legacy Proforma total without updating its stored row', async () => {
  const fixture = invoiceFixture(root, 'penjualanInterior');
  const stored = { ...sale, proformas: [{ id: 1, total: 33317 }] };
  fixture.models.PenjualanInterior.findByPk = async () => ({ toJSON: () => stored });
  const result = await fixture.call('get', '/:id');
  expect(result.status).toBe(200);
  expect(result.body.proformas[0].total).toBe(33318);
  expect(stored.proformas[0].total).toBe(33317);
  expect(result.writes).toEqual([]);
});

test('Proforma creation saves the same rounded total as the invoice', async () => {
  const fixture = invoiceFixture(root, 'penjualanInterior');
  fixture.models.PenjualanInterior.findByPk = async () => sale;
  fixture.models.PenjualanInteriorItem.findAll = async () => [item];
  const result = await fixture.call('post', '/:id/proforma', { tanggal: '2026-11-05' });
  expect(result.status).toBe(201);
  expect(result.writes[0].total).toBe(33318);
});

test('full payment accepts the invoice amount without a 1-rupiah overpayment error', async () => {
  const fixture = invoiceFixture(root, 'penjualanInterior');
  fixture.models.PenjualanInterior.findByPk = async () => sale;
  fixture.models.PenjualanInteriorItem.findAll = async () => [item];
  fixture.models.sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
  const result = await fixture.call('post', '/:id/pembayaran', { tipe: 'PELUNASAN_PENUH', jumlah: 33318 });
  expect(result.status).toBe(201);
});

test.each(['piutangUsaha', 'transaksi'])('%s recognizes the same rounded invoice amount', async route => {
  const fixture = invoiceFixture(root, route);
  fixture.models.ChartOfAccount.findOrCreate = async () => [{}];
  fixture.models.InvoiceInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-05', nomor_invoice: 'INV-FIXTURE', surat_jalan_ids: '[1]', penjualan: sale }];
  fixture.models.SuratJalanInterior.findAll = async () => [{ items: [{ item, qty_kirim: 3 }] }];
  const result = await fixture.call('get', route === 'piutangUsaha' ? '/rekap' : '/');
  expect(result.status).toBe(200);
  if (route === 'piutangUsaha') expect(result.body.data[0].debit).toBe(33318);
  else {
    const row = result.body.data.find(row => row.jenis === 'INVOICE');
    expect(row.nilai).toBe(33318);
    expect(row.balanced).toBe(true);
  }
});

test('physical SJ return leaves the rounded project value unchanged', async () => {
  const fixture = invoiceFixture(root, 'keuangan');
  fixture.models.sequelize.fn = (...args) => args;
  fixture.models.sequelize.col = name => name;
  fixture.models.PenjualanInterior.findAll = async () => [sale];
  fixture.models.PenjualanInterior.findAndCountAll = async () => ({ count: 1, rows: [sale] });
  fixture.models.ReturSJInterior.findAll = async () => [{ penjualan_interior_item_id: 1, total_retur: 1 }];
  const result = await fixture.call('get', '/interior');
  expect(result.status).toBe(200);
  expect(result.body.summary.totalNilaiProyek).toBe(33318);
  expect(result.body.list[0].grandTotal).toBe(33318);
});
