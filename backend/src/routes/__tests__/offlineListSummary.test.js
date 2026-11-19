const { models, route, invoke } = require('../../../tests/financeFixture.cjs');
const { Op } = require('sequelize');
const records = () => [
  { id: 1, faktur: 'FAKTUR', items: [{ id: 1, qty: 2, subtotal: 200000 }], returs: [{ penjualan_offline_item_id: 1, qty_retur: 1 }] },
  { id: 2, faktur: 'NON_FAKTUR', items: [{ id: 2, qty: 1, subtotal: 250000 }], returs: [] },
];

test('Offline groups FAKTUR/non-FAKTUR net sales after returns, across all matched pages', async () => {
  const m = models(), rows = records(); let metadata, page;
  m.PenjualanOffline.findAll = async query => { metadata = query; return rows; };
  m.PenjualanOffline.findAndCountAll = async query => { page = query; return { count: 2, rows: [rows[1]] }; };
  const res = await invoke(route('penjualanOffline', m), '/', { page: 2, limit: 1, tipe: 'PENJUALAN', search: 'Customer', tanggal_dari: '2026-11-01', tanggal_sampai: '2026-11-19' });
  expect(res.summary).toMatchObject({ penjualanPpn: 100000, penjualanNonPpn: 250000, totalNilai: 350000, totalNilaiGross: 450000, totalNilaiRetur: 100000 });
  expect(res.summary.penjualanPpn + res.summary.penjualanNonPpn).toBe(res.summary.totalNilai);
  expect(res.data).toHaveLength(1);
  expect(metadata.attributes).toContain('faktur'); expect(metadata.where).toEqual(page.where);
  expect(metadata.where.tipe).toBe('PENJUALAN'); expect(metadata.where.tanggal[Op.gte]).toBe('2026-11-01');
});

test('Offline empty filters produce zero groups without changing the existing total', async () => {
  const m = models();
  expect((await invoke(route('penjualanOffline', m), '/')).summary).toMatchObject({ penjualanPpn: 0, penjualanNonPpn: 0, totalNilai: 0 });
});

test('Offline faktur filter is applied before grouping and does not change return or quantity calculations', async () => {
  const m = models(), rows = records().slice(0, 1); let where;
  m.PenjualanOffline.findAll = async query => { where = query.where; return rows; };
  m.PenjualanOffline.findAndCountAll = async () => ({ count: 1, rows });
  const res = await invoke(route('penjualanOffline', m), '/', { faktur: 'FAKTUR' });
  expect(where.faktur).toBe('FAKTUR'); expect(where.is_test).toBe(0);
  expect(res.summary).toMatchObject({ penjualanPpn: 100000, penjualanNonPpn: 0, totalNilai: 100000, totalQty: 1, totalQtyRetur: 1 });
});
