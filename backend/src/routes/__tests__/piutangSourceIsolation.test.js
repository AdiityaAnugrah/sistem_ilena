jest.mock('../../models', () => {
  const names = ['Invoice', 'PembayaranOffline', 'ReturOffline', 'SuratPengantar', 'PenjualanOffline', 'MutasiDisplay', 'ProformaInvoice', 'InvoiceInterior', 'PembayaranInterior', 'ReturSJInterior', 'SuratJalanInterior'];
  return Object.fromEntries(names.map(name => [name, { findAll: jest.fn() }]));
});
jest.mock('../../middleware/auth', () => ({
  authenticate: (req, res, next) => { req.user = { role: req.headers['x-test-role'] || 'ADMIN' }; next(); },
}));
const express = require('express');
const request = require('supertest');
const models = require('../../models');
const app = express();
app.use('/piutang-usaha', require('../piutangUsaha'));
const offline = ['Invoice', 'PembayaranOffline', 'ReturOffline', 'SuratPengantar', 'PenjualanOffline', 'MutasiDisplay'];
const interior = ['ProformaInvoice', 'InvoiceInterior', 'PembayaranInterior', 'ReturSJInterior'];

beforeEach(() => {
  jest.resetAllMocks();
  Object.values(models).forEach(model => model.findAll.mockResolvedValue([]));
  models.InvoiceInterior.findAll.mockResolvedValue([{
    id: 1, penjualan_interior_id: 10, tanggal: '2026-01-02', nomor_invoice: 'INV-10',
    penjualan: { id: 10, nama_customer: 'Interior Fixture', no_po: 'PO-10', faktur: 'FAKTUR', pakai_ppn: 0, items: [{ qty: 1, subtotal: 1000 }] },
  }]);
});

describe('isolasi sumber laporan piutang', () => {
  test.each(['rekap', 'detail'])('INTERIOR %s tetap tampil ketika tabel Offline gagal', async endpoint => {
    offline.forEach(name => models[name].findAll.mockRejectedValue(new Error('Offline table missing')));
    const res = await request(app).get(`/piutang-usaha/${endpoint}?sumber=INTERIOR`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].debit).toBe(1000);
    offline.forEach(name => expect(models[name].findAll).not.toHaveBeenCalled());
  });
  test.each(['rekap', 'detail'])('OFFLINE %s tidak membaca tabel Interior', async endpoint => {
    interior.forEach(name => models[name].findAll.mockRejectedValue(new Error('Interior table missing')));
    const res = await request(app).get(`/piutang-usaha/${endpoint}?sumber=OFFLINE`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    interior.forEach(name => expect(models[name].findAll).not.toHaveBeenCalled());
  });
  test('tanpa filter sumber tetap membaca kedua sumber', async () => {
    const res = await request(app).get('/piutang-usaha/rekap');
    expect(res.status).toBe(200);
    [...offline, ...interior].forEach(name => expect(models[name].findAll).toHaveBeenCalledTimes(1));
  });
  test.each([['ADMIN', 0], ['TEST', 1]])('pemisahan data role %s tetap dipertahankan', async (role, isTest) => {
    const res = await request(app).get('/piutang-usaha/rekap?sumber=interior').set('x-test-role', role);
    expect(res.status).toBe(200);
    expect(models.InvoiceInterior.findAll.mock.calls[0][0].include[0].where).toEqual({ is_test: isTest });
    expect(models.Invoice.findAll).not.toHaveBeenCalled();
  });
});

describe('Sub-Invoice masuk piutang dan alokasi uang muka', () => {
  const setup = (paid = 0) => {
    const penjualan = { id: 80, nama_customer: 'Putrawijaya Fixture', no_po: '-', faktur: 'NON_FAKTUR', pakai_ppn: 0, items: [{ qty: 1, subtotal: 17000000 }] };
    models.InvoiceInterior.findAll.mockResolvedValue([]);
    models.ProformaInvoice.findAll.mockResolvedValue([{ id: 100, penjualan_interior_id: 80, tanggal: '2026-09-16', nomor_sub_invoice: 'NF00016', terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]', penjualan }]);
    models.PembayaranInterior.findAll.mockResolvedValue(paid ? [{ id: 100, penjualan_interior_id: 80, tanggal: '2026-09-15', jumlah: paid, tipe: 'DP', penjualan }] : []);
  };
  test('customer dengan Sub-Invoice tanpa invoice pengiriman muncul di rekap', async () => {
    setup();
    const res = await request(app).get('/piutang-usaha/rekap?sumber=INTERIOR');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ nama_customer: 'Putrawijaya Fixture', debit: 17000000, piutang: 17000000 });
  });
  test('Sub-Invoice lunas muncul dengan saldo nol dan referensi pada detail', async () => {
    setup(17000000);
    const rekap = await request(app).get('/piutang-usaha/rekap?sumber=INTERIOR');
    expect(rekap.body.data[0]).toMatchObject({ debit: 17000000, kredit: 17000000, piutang: 0 });
    const detail = await request(app).get('/piutang-usaha/detail?sumber=INTERIOR');
    expect(detail.body.data.find(d => d.referensi === 'NF00016' && d.debit > 0)).toMatchObject({ debit: 17000000 });
  });
  test('uang muka terpakai pada Sub-Invoice, bukan tetap menggantung', async () => {
    setup(17000000);
    const res = await request(app).get('/piutang-usaha/uang-muka-interior');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ uang_muka_masuk: 17000000, uang_muka_terpakai: 17000000, sisa_uang_muka: 0 });
  });
});
