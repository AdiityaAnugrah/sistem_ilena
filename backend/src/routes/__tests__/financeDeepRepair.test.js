const { models, route, invoke } = require('../../../tests/financeFixture.cjs');
const sale = () => ({ id: 1, is_test: 0, nama_customer: 'Customer', nama_penerima: 'Customer', nama_pelanggan: 'Customer',
  faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11, status: 'ACTIVE', tipe: 'PENJUALAN',
  items: [{ id: 1, qty: 1, harga_satuan: 1000000, subtotal: 1000000 }] });

test('same-gross DPP/PPN correction changes only revenue/tax, not customer debt', async () => {
  const { createInvoiceBasis } = require('../../utils/invoiceBasis');
  const m = models(), p = { ...sale(), ppn_persen: 11, items: [{ qty: 1, harga_satuan: 319, subtotal: 319 }] };
  m.ProformaInvoice.findAll = async () => [
    { id: 1, penjualan_interior_id: 1, tanggal: '2026-10-01', nomor_sub_invoice: 'SUB1', penjualan: p, terms: '[{"tipe":"DP","jumlah":177}]' },
    { id: 2, penjualan_interior_id: 1, tanggal: '2026-10-02', nomor_sub_invoice: 'SUB2', penjualan: p, terms: '[{"tipe":"TERMIN_1","jumlah":177}]' },
  ];
  m.InvoiceInterior.findAll = async () => [{ id: 3, penjualan_interior_id: 1, tanggal: '2026-10-03', penjualan: p }];
  const data = await createInvoiceBasis(m).load({ source: 'INTERIOR' });
  expect(data.documents.reduce((n, row) => n + row.net, 0)).toBe(319);
  expect(data.documents.reduce((n, row) => n + row.gross, 0)).toBe(354);
  expect(data.entries.reduce((n, row) => n + row.debit - row.kredit, 0)).toBe(354);
  expect(data.journal.some(row => row.jenis === 'PENYESUAIAN_PPN')).toBe(true);
  for (const row of data.journal) {
    expect(row.lines.reduce((n, line) => n + line.debit - line.kredit, 0)).toBe(0);
    expect(row.lines.every(line => line.debit >= 0 && line.kredit >= 0)).toBe(true);
  }
});

test.each(['Interior', 'Offline'])('%s retains opening invoice debt when only payment occurs in selected month', async source => {
  const m = models(), p = sale(), fk = `penjualan_${source.toLowerCase()}_id`;
  m[source === 'Interior' ? 'InvoiceInterior' : 'Invoice'].findAll = async () => [{ id: 1, [fk]: 1, tanggal: '2026-10-01', nomor_invoice: 'INV', ppn_persen: 11, penjualan: p }];
  m[`Pembayaran${source}`].findAll = async () => [{ id: 1, [fk]: 1, tanggal: '2026-11-02', jumlah: 100000, penjualan: p }];
  const res = await invoke(route('keuangan', m), `/${source.toLowerCase()}`, { from: '2026-11-01', to: '2026-11-19' });
  expect(res.summary[source === 'Interior' ? 'totalNilaiProyek' : 'totalOmzet']).toBe(0);
  expect(res.summary[source === 'Interior' ? 'totalOutstanding' : 'totalBelumLunas']).toBe(1010000);
  expect(res.list[0].sisa).toBe(1010000);
});

test('Offline search filters summary and list to same customers', async () => {
  const m = models();
  m.Invoice.findAll = async () => [sale(), { ...sale(), id: 2, nama_penerima: 'Other' }].map(p => ({ id: p.id, penjualan_offline_id: p.id, tanggal: '2026-10-01', nomor_invoice: 'INV', penjualan: p }));
  const res = await invoke(route('keuangan', m), '/offline', { search: 'Customer' });
  expect(res.summary.totalOmzet).toBe(1000000);
  expect(res.summary.totalBelumLunas).toBe(1000000);
  expect(res.total).toBe(1);
});

test.each(['2026-10-01', '2026-10-03'])('Online refunded net payment is independent of invoice date %s', async date => {
  const m = models(), p = sale();
  m.InvoiceOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: date, nomor_invoice: 'INV', penjualan: p }];
  m.PembayaranOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-10-01', jumlah: 1000000, penjualan: p }];
  m.ReturOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-10-02', tipe: 'PENGEMBALIAN_DANA', jumlah_refund: 200000, penjualan: p }];
  const res = await invoke(route('keuangan', m), '/online');
  expect(res.list[0]).toMatchObject({ total: 800000, terbayar: 800000, sisa: 0 });
});

test('undated legacy Online net income is not a dated bank receipt or negative period margin', async () => {
  const m = models(), p = { ...sale(), pendapatan_bersih: 750000 };
  m.InvoiceOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-10-01', nomor_invoice: 'INV', penjualan: p }];
  m.ReturOnline.findAll = async () => [{ id: 1, penjualan_online_id: 1, tanggal: '2026-10-02', tipe: 'PENGEMBALIAN_DANA', jumlah_refund: 200000, penjualan: p }];
  const res = await invoke(route('keuangan', m), '/online', { from: '2026-10-02', to: '2026-10-02' });
  expect(res.list[0].pendapatan_bersih).toBeNull();
  expect(res.list[0].selisih).toBeNull();
});

test('multi-item nominal Sub-Invoice and final invoice exactly reconcile DPP/PPN for300 combinations', async () => {
  const { buildEffectiveInteriorInvoices } = require('../../utils/interiorReceivables');
  const { createInteriorFinance } = require('../../utils/interiorFinance');
  for (let seed = 1; seed <= 300; seed++) {
    const p = { ...sale(), biaya_kirim: seed % 11, items: [
      { qty: seed % 5 + 1, harga_satuan: seed * 73 + 100 }, { qty: seed % 3 + 1, harga_satuan: seed * 31 + 500 }] };
    const inv = { id: 2, penjualan_interior_id: 1, tanggal: '2026-11-02', penjualan: p };
    const full = await createInteriorFinance(models()).invoiceInteriorAmount(inv);
    const sub = { id: 1, penjualan_interior_id: 1, tanggal: '2026-11-01', nomor_sub_invoice: 'SUB', terms: JSON.stringify([{ tipe: 'DP', jumlah: Math.round(full.total * 0.31) }]), penjualan: p };
    const docs = await buildEffectiveInteriorInvoices([inv], [sub], async () => full);
    expect(docs.reduce((n, row) => n + row._ledgerAmount.subtotal, 0)).toBe(full.subtotal);
    expect(docs.reduce((n, row) => n + row._ledgerAmount.ppn, 0)).toBe(full.ppn);
    expect(docs.reduce((n, row) => n + row._ledgerAmount.total, 0)).toBe(full.total);
  }
});
