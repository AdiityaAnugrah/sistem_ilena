const { buildOnlineJournal } = require('../onlineJournal');
const line = (code, debit = 0, kredit = 0) => ({ account_code: code, debit, kredit });
const sale = { id: 1, id_pesanan: 'ORDER', nama_pelanggan: 'Customer', status: 'SELESAI', pendapatan_bersih: 80000, items: [{ qty: 1, subtotal: 100000 }] };
const invoice = (date = '2026-01-10') => ({ id: 1, tanggal: date, penjualan_online_id: 1, nomor_invoice: 'INV', penjualan: sale });
const pay = (date = '2026-01-10') => ({ id: 1, tanggal: date, penjualan_online_id: 1, jumlah: 100000, penjualan: sale });
const refund = (amount, date) => ({ id: 1, tanggal: date, penjualan_online_id: 1, tipe: 'PENGEMBALIAN_DANA', jumlah_refund: amount, penjualan: sale });
const balance = (rows, account) => rows.flatMap(r => r.lines).filter(l => l.account_code === account).reduce((n, l) => n + l.debit - l.kredit, 0);
const balanced = rows => rows.every(r => r.lines.reduce((n, l) => n + l.debit - l.kredit, 0) === 0);

test('customer payment is gateway money and unearned advance, never automatic bank settlement', () => {
  const rows = buildOnlineJournal([], [pay()], [], line);
  expect(balance(rows, '1106')).toBe(100000);
  expect(balance(rows, '2102')).toBe(-100000);
  expect(balance(rows, '1102')).toBe(0);
  expect(balance(rows, '1201')).toBe(0);
  expect(balanced(rows)).toBe(true);
});

test('invoice and customer payment clear receivable without reading net settlement as a second payment', () => {
  const rows = buildOnlineJournal([invoice()], [pay()], [], line);
  expect(balance(rows, '1106')).toBe(100000);
  expect(balance(rows, '1201')).toBe(0);
  expect(rows.filter(r => r.jenis === 'PEMBAYARAN')).toHaveLength(1);
  expect(balanced(rows)).toBe(true);
});

test('refund after billing reduces gateway money and net sales without negative receivable', () => {
  const rows = buildOnlineJournal([invoice()], [pay()], [refund(20000, '2026-01-11')], line);
  expect(balance(rows, '1106')).toBe(80000);
  expect(balance(rows, '1201')).toBe(0);
  expect(balance(rows, '4103') + balance(rows, '4203')).toBe(-80000);
  expect(balanced(rows)).toBe(true);
});

test('refund before invoice reverses advance, then is recognized only once at billing', () => {
  const rows = buildOnlineJournal([invoice('2026-01-12')], [pay('2026-01-10')], [refund(20000, '2026-01-11')], line);
  expect(balance(rows, '1106')).toBe(80000);
  expect(balance(rows, '1201')).toBe(0);
  expect(balance(rows, '2102')).toBe(0);
  expect(balance(rows, '4103') + balance(rows, '4203')).toBe(-80000);
  expect(rows.filter(r => r.jenis === 'RETUR')).toHaveLength(1);
  expect(balanced(rows)).toBe(true);
});

test('cancelled order retains customer money as liability until refunded, without recognizing sales', () => {
  const p = { ...sale, status: 'DIBATALKAN' };
  const rows = buildOnlineJournal([{ ...invoice(), penjualan: p }], [{ ...pay(), penjualan: p }], [{ ...refund(100000, '2026-01-11'), penjualan: p }], line);
  expect(rows.some(r => r.jenis === 'INVOICE')).toBe(false);
  expect(balance(rows, '1106')).toBe(0);
  expect(balance(rows, '2102')).toBe(0);
  expect(balanced(rows)).toBe(true);
});

test('reissued Online invoices count once and replacement-only returns do not refund money', () => {
  const rows = buildOnlineJournal([invoice(), { ...invoice('2026-01-12'), id: 2 }], [pay()], [{ ...refund(20000, '2026-01-11'), tipe: 'PENGGANTIAN_BARANG' }], line);
  expect(rows.filter(r => r.jenis === 'INVOICE')).toHaveLength(1);
  expect(rows.some(r => r.jenis === 'RETUR')).toBe(false);
  expect(balance(rows, '1201')).toBe(0);
  expect(balanced(rows)).toBe(true);
});
