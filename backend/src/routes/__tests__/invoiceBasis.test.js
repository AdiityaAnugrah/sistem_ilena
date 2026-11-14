const { models, route, invoke } = require('../../../tests/financeFixture.cjs');
const sale = (id = 1) => ({ id, nama_customer: 'Customer', nama_penerima: 'Customer', nama_pelanggan: 'Customer',
  tanggal: '2026-10-01', no_po: 'PO', id_pesanan: 'ORDER', faktur: 'FAKTUR', status: 'ACTIVE', tipe: 'PENJUALAN',
  pakai_ppn: 1, ppn_persen: 11, items: [{ id, qty: 1, harga_satuan: 1000000, subtotal: 1000000 }], pembayarans: [] });
const inv = (p, source = 'Interior', extra = {}) => ({ id: p.id, [`penjualan_${source.toLowerCase()}_id`]: p.id,
  tanggal: '2026-11-01', nomor_invoice: 'INV-' + p.id, ppn_persen: 11, penjualan: p, ...extra });

test('Interior finance excludes unbilled projects and separates net sales from gross debt', async () => {
  const m = models(), p = sale(), unbilled = sale(2);
  m.PenjualanInterior.findAll = async () => [p, unbilled];
  m.PenjualanInterior.findAndCountAll = async () => ({ count: 2, rows: [p, unbilled] });
  m.InvoiceInterior.findAll = async () => [inv(p)];
  m.PembayaranInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-11-02', jumlah: 500000, penjualan: p }];
  const result = await invoke(route('keuangan', m), '/interior');
  expect(result.summary).toMatchObject({ totalNilaiProyek: 1000000, totalTerbayar: 500000, totalOutstanding: 610000 });
  expect(result.list).toHaveLength(1);
  expect(result.list[0]).toMatchObject({ grandTotal: 1000000, total_tagihan: 1110000, sisa: 610000 });
});

test('paid Interior invoice remains net sales while receivable becomes zero', async () => {
  const m = models(), p = sale();
  m.InvoiceInterior.findAll = async () => [inv(p)];
  m.PembayaranInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-20', jumlah: 1110000, penjualan: p }];
  const result = await invoke(route('keuangan', m), '/interior');
  expect(result.summary.totalNilaiProyek).toBe(1000000);
  expect(result.summary.totalOutstanding).toBe(0);
});

test('Offline sales require an invoice and AR ignores bare SP Display', async () => {
  const m = models(), p = sale(), d = { ...sale(2), tipe: 'DISPLAY' };
  m.Invoice.findAll = async () => [inv(p, 'Offline')];
  m.PenjualanOffline.findAll = async () => [p, d];
  m.PenjualanOffline.findAndCountAll = async () => ({ count: 2, rows: [p, d] });
  m.PenjualanOfflineItem.findAll = async () => [...p.items, ...d.items];
  m.SuratPengantar.findAll = async () => [{ id: 1, penjualan_offline_id: 2, tanggal: '2026-11-01', penjualan: d }];
  m.PembayaranOffline.findAll = async () => [{ id: 1, penjualan_offline_id: 1, tanggal: '2026-11-02', jumlah: 500000, penjualan: p }];
  const finance = await invoke(route('keuangan', m), '/offline', { tab: 'penjualan' });
  expect(finance.summary.totalOmzet).toBe(1000000);
  expect(finance.list).toHaveLength(1);
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'OFFLINE' });
  expect(ar.summary.saldoAkhir).toBe(610000);
  expect(ar.data).toHaveLength(1);
});

test('Online finance and AR use issued invoice, not order value or bank payout', async () => {
  const m = models(), p = { ...sale(), status: 'SELESAI', pendapatan_bersih: 900000 }, noInvoice = sale(2);
  m.InvoiceOnline.findAll = async () => [inv(p, 'Online')];
  m.PembayaranOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-10-20', jumlah: 400000, penjualan: p }];
  m.PenjualanOnline.findAll = async () => [p, noInvoice];
  m.PenjualanOnline.findAndCountAll = async () => ({ count: 2, rows: [p, noInvoice] });
  m.PenjualanOnlineItem.findAll = async () => [1, 2].map(id => ({ penjualan_online_id: id, subtotal: 1000000 }));
  const finance = await invoke(route('keuangan', m), '/online');
  expect(finance.summary.totalNilai).toBe(1000000);
  expect(finance.list).toHaveLength(1);
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'ONLINE' });
  expect(ar.summary.saldoAkhir).toBe(600000);
  expect(ar.data[0].sumber).toBe('ONLINE');
});

test('numbered installment and final invoice count once; ordinary Proforma never counts', async () => {
  const m = models(), p = sale();
  m.InvoiceInterior.findAll = async () => [inv(p, 'Interior', { tanggal: '2026-11-03' })];
  m.ProformaInvoice.findAll = async () => [
    { id: 2, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: 'SUB', terms: '[{"tipe":"DP","persen":30}]', penjualan: p },
    { id: 3, penjualan_interior_id: 1, tanggal: '2026-10-10', nomor_sub_invoice: null, total: 1110000, penjualan: p },
  ];
  const finance = await invoke(route('keuangan', m), '/interior');
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'INTERIOR' });
  expect(finance.summary.totalNilaiProyek).toBe(1000000);
  expect(ar.summary.debit).toBe(1110000);
});

test.each([0, 11, 12])('partial invoices and optional charges keep exact net/gross separation, VAT=%s', async ppn => {
  const m = models(), p = { ...sale(), ppn_persen: ppn, pakai_ppn: ppn > 0 ? 1 : 0,
    biaya_assembly: 100000, biaya_kirim: 200000, items: [{ id: 1, qty: 10, harga_satuan: 10005, subtotal: 100050 }] };
  m.InvoiceInterior.findAll = async () => [inv(p, 'Interior', { surat_jalan_interior_id: 1 })];
  m.SuratJalanInterior.findAll = async () => [{ id: 1, items: [{ qty_kirim: 4, item: p.items[0] }] }];
  const finance = await invoke(route('keuangan', m), '/interior');
  const grossGoods = Math.round(10005 * (1 + ppn / 100)) * 4;
  expect(finance.list[0].grandTotal).toBe(40020 + 120000);
  expect(finance.list[0].total_tagihan).toBe(grossGoods + 120000);
  expect(finance.summary.totalOutstanding).toBe(grossGoods + 120000);
});

test('invoice date defines sales period, prior payments still reduce current gross debt', async () => {
  const m = models(), p = sale();
  m.InvoiceInterior.findAll = async () => [inv(p)];
  m.PembayaranInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-05', jumlah: 500000, penjualan: p }];
  const result = await invoke(route('keuangan', m), '/interior', { from: '2026-11-01', to: '2026-11-14' });
  expect(result.summary.totalNilaiProyek).toBe(1000000);
  expect(result.summary.totalOutstanding).toBe(610000);
  expect((await invoke(route('keuangan', m), '/interior', { to: '2026-10-31' })).summary.totalNilaiProyek).toBe(0);
});

test('Offline reprints do not multiply invoice sales and non-invoiced payments never create negative AR', async () => {
  const m = models(), p = sale();
  m.Invoice.findAll = async () => [inv(p, 'Offline'), inv(p, 'Offline', { id: 2, tanggal: '2026-11-02' })];
  m.PembayaranOffline.findAll = async () => [{ id: 1, penjualan_offline_id: 1, tanggal: '2026-10-01', jumlah: 500000, penjualan: p },
    { id: 2, penjualan_offline_id: 2, tanggal: '2026-10-01', jumlah: 700000, penjualan: sale(2) }];
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'OFFLINE' });
  expect(ar.summary.debit).toBe(1110000);
  expect(ar.summary.saldoAkhir).toBe(610000);
  expect(ar.summary.lebihBayar).toBe(0);
});

test('all-sales net summary equals financial invoice summaries, not unbilled registry amounts', async () => {
  const m = models(), p = sale();
  m.InvoiceInterior.findAll = async () => [inv(p)];
  m.sequelize.query = async sql => sql.includes('AS combined') ? [{ total: 2 }] : [];
  const all = await invoke(route('penjualan', m), '/semua', { sumber: 'INTERIOR' });
  expect(all.summary.totalNilai).toBe(1000000);
});

test('net amounts remain exact after a nominal Sub-Invoice and final shipment', async () => {
  const { createInvoiceBasis } = require('../../utils/invoiceBasis');
  const { createInteriorFinance } = require('../../utils/interiorFinance');
  for (const price of [10005, 146088, 99999]) for (const amount of [1, 3333, 10001]) {
    const m = models(), p = { ...sale(), biaya_kirim: 107, items: [{ qty: 3, harga_satuan: price, subtotal: price * 3 }] };
    m.ProformaInvoice.findAll = async () => [{ id: 2, penjualan_interior_id: 1, nomor_sub_invoice: 'SUB', tanggal: '2026-10-01', terms: JSON.stringify([{ tipe: 'DP', jumlah: amount }]), penjualan: p }];
    m.InvoiceInterior.findAll = async () => [inv(p)];
    const data = await createInvoiceBasis(m).load({ source: 'INTERIOR' });
    const original = await createInteriorFinance(m).invoiceInteriorAmount(inv(p));
    expect(data.documents.reduce((sum, row) => sum + row.net, 0)).toBe(original.subtotal);
    expect(data.documents.reduce((sum, row) => sum + row.gross, 0)).toBe(original.total);
  }
});

test('period net revenue excludes earlier DP while gross balance/progress retain its history', async () => {
  const m = models(), p = sale();
  m.ProformaInvoice.findAll = async () => [{ id: 2, penjualan_interior_id: 1, nomor_sub_invoice: 'SUB', tanggal: '2026-10-01', terms: '[{"tipe":"DP","persen":30}]', penjualan: p }];
  m.InvoiceInterior.findAll = async () => [inv(p)];
  m.PembayaranInterior.findAll = async () => [{ id: 1, penjualan_interior_id: 1, tanggal: '2026-10-02', jumlah: 333000, penjualan: p }];
  const result = await invoke(route('keuangan', m), '/interior', { from: '2026-11-01', to: '2026-11-14' });
  expect(result.summary.totalNilaiProyek).toBe(700000);
  expect(result.list[0]).toMatchObject({ total_tagihan: 1110000, terbayar: 333000, sisa: 777000, persen: 30 });
});

test('a financial return in a later period reduces net sales, not unrelated new invoice rows', async () => {
  const m = models(), p = sale();
  m.Invoice.findAll = async () => [inv(p, 'Offline', { tanggal: '2026-10-01' })];
  m.PembayaranOffline.findAll = async () => [{ id: 1, penjualan_offline_id: 1, tanggal: '2026-10-02', jumlah: 1110000, penjualan: p }];
  m.ReturOffline.findAll = async () => [{ id: 1, penjualan_offline_id: 1, tanggal: '2026-11-01', qty_retur: 1, item: p.items[0], penjualan: p }];
  const result = await invoke(route('keuangan', m), '/offline', { from: '2026-11-01', to: '2026-11-14' });
  expect(result.summary.totalOmzet).toBe(-1000000);
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'OFFLINE', to: '2026-11-14' });
  expect(ar.summary.saldoAkhir).toBe(0);
});

test('an actual invoice on a Display parent counts once; its SP does not add a second debt', async () => {
  const m = models(), p = { ...sale(), tipe: 'DISPLAY' }; let include;
  m.Invoice.findAll = async options => { include = options.include[0]; return [inv(p, 'Offline')]; };
  m.SuratPengantar.findAll = async () => [{ id: 1, penjualan: p, penjualan_offline_id: 1, tanggal: '2026-11-01' }];
  const ar = await invoke(route('piutangUsaha', m), '/rekap', { sumber: 'OFFLINE' });
  expect(include.where.tipe).toBeUndefined();
  expect(ar.summary.debit).toBe(1110000);
});
