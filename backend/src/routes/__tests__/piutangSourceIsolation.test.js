jest.mock('../../models', () => {
  const names = ['Invoice', 'PembayaranOffline', 'ReturOffline', 'SuratPengantar', 'PenjualanOffline', 'MutasiDisplay', 'InvoiceInterior', 'PembayaranInterior', 'ReturSJInterior', 'SuratJalanInterior'];
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
const interior = ['InvoiceInterior', 'PembayaranInterior', 'ReturSJInterior'];

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
