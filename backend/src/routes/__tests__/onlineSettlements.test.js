const { models, route, respond, invoke } = require('../../../tests/financeFixture.cjs');
const { validateSettlement, assertGatewayAvailable } = require('../../utils/onlineSettlements');
const value = { tanggal: '2026-01-10', referensi: 'BANK-1', jumlah_bruto: 100000, biaya: 10000 };
test.each([{ biaya: '' }, { biaya: null }, { biaya: true }, { jumlah_bruto: true }, { jumlah_bruto: 1.5 }, { biaya: -1 }, { biaya: 100001 }, { tanggal: '2026-02-30' }, { tanggal: '2099-01-01' }, { referensi: '' }])('invalid payout fields are rejected: %j', fields => {
  expect(() => validateSettlement({ ...value, ...fields })).toThrow();
});
function fixture() {
  const m = models(), rows = [], parent = { id: 1, nama_pelanggan: 'Customer', id_pesanan: 'ORDER', is_test: 0, items: [{ subtotal: 100000 }] };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}) };
  m.sequelize.transaction = jest.fn(async () => transaction);
  m.PenjualanOnline.findOne = jest.fn(async () => parent);
  m.PencairanOnline.findAll = async () => rows;
  m.PencairanOnline.create = jest.fn(async row => { const result = { id: rows.length + 1, ...row, penjualan: parent }; rows.push(result); return result; });
  m.PembayaranOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-01-09', jumlah: 100000, penjualan: parent }];
  return { m, rows, parent, transaction };
}

test.each([{ jumlah_bruto: -1 }, { jumlah_bruto: 1.2 }, { jumlah_bruto: 'bad' }, { jumlah_bruto: 10000000000000 }, { biaya: -1 }, { biaya: 100001 }, { biaya: '' }, { biaya: null }, { referensi: '' }, { tanggal: '2026-02-30' }, { tanggal: '2099-01-01' }])('rejects invalid settlement %j', override => {
  expect(() => validateSettlement({ ...value, ...override })).toThrow();
});

test('settlement endpoint commits once; duplicate retry is idempotent and conflicting retry is rejected', async () => {
  const { m, rows, transaction } = fixture(), router = route('penjualanOnline', m);
  const first = await respond(router, '/:id/pencairan', {}, value, 'post');
  expect(first.code).toBe(201); expect(rows[0].jumlah_bersih).toBe(90000);
  expect(m.PenjualanOnline.findOne.mock.calls[0][0]).toMatchObject({ where: { id: 1, is_test: 0 }, lock: 'UPDATE' });
  expect(transaction.commit).toHaveBeenCalledTimes(1);
  const retry = await respond(router, '/:id/pencairan', {}, value, 'post');
  expect(retry.body.duplicate).toBe(true); expect(rows).toHaveLength(1);
  const conflict = await respond(router, '/:id/pencairan', {}, { ...value, biaya: 20000 }, 'post');
  expect(conflict.code).toBe(409); expect(rows).toHaveLength(1);
});

test('payout is rejected before funds exist and if later payouts/refunds would overdraw', () => {
  expect(() => assertGatewayAvailable([{ tanggal: '2026-01-11', jumlah: 100000 }], [], [], validateSettlement(value))).toThrow();
  expect(() => assertGatewayAvailable([{ tanggal: '2026-01-09', jumlah: 100000 }], [], [{ tanggal: '2026-01-11', jumlah_bruto: 50000 }], validateSettlement(value))).toThrow();
  expect(() => assertGatewayAvailable([{ tanggal: '2026-01-09', jumlah: 100000 }], [{ tanggal: '2026-01-11', jumlah_refund: 10000 }], [], validateSettlement(value))).toThrow();
});

test('overdrawn endpoint rolls back without insert and missing parent is404', async () => {
  const { m, transaction } = fixture();
  const res = await respond(route('penjualanOnline', m), '/:id/pencairan', {}, { ...value, jumlah_bruto: 100001 }, 'post');
  expect(res.code).toBe(400); expect(transaction.rollback).toHaveBeenCalled(); expect(m.PencairanOnline.create).not.toHaveBeenCalled();
  m.PenjualanOnline.findOne = async () => null;
  expect((await respond(route('penjualanOnline', m), '/:id/pencairan', {}, value, 'post')).code).toBe(404);
});

test('settlement journal clears gateway into bank+fees without changing customer debt or revenue', async () => {
  const { m, rows, parent } = fixture();
  await respond(route('penjualanOnline', m), '/:id/pencairan', {}, value, 'post');
  m.InvoiceOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-01-09', penjualan: parent }];
  const res = await invoke(route('transaksi', m), '/', { sumber: 'ONLINE' });
  const payout = res.data.find(row => row.jenis === 'PENCAIRAN');
  expect(payout.balanced).toBe(true);
  expect(payout.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ account_code: '1102', debit: 90000 }),
    expect.objectContaining({ account_code: '6101', debit: 10000 }),
    expect.objectContaining({ account_code: '1106', kredit: 100000 }),
  ]));
  expect(rows).toHaveLength(1);
  const ledger = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'ONLINE' });
  expect(ledger.summary.saldoAkhir).toBe(0);
  const finance = route('keuangan', m);
  expect((await invoke(finance, '/online', { from: '2026-01-10', to: '2026-01-10' })).summary).toMatchObject({ totalNilai: 0, totalPendapatanBersih: 90000, totalSelisih: 10000 });
  expect((await invoke(finance, '/online', { to: '2026-01-09' })).summary.totalPendapatanBersih).toBe(0);
});

test('role/TEST isolation is applied before payout and read-only roles cannot create payout', async () => {
  const { m } = fixture(), router = route('penjualanOnline', m);
  const handler = router.stack.find(layer => layer.route?.path === '/:id/pencairan').route.stack.at(-1).handle;
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: value, params: { id: 1 }, user: { role: 'STAFF', id: 1 } }, res);
  expect(res.code).toBe(403); expect(m.sequelize.transaction).not.toHaveBeenCalled();
  await handler({ body: value, params: { id: 1 }, user: { role: 'TEST', id: 1 } }, res);
  expect(m.PenjualanOnline.findOne.mock.calls[0][0].where.is_test).toBe(1);
});
