const { interiorTerm, validateInteriorTerms } = require('../interiorTerm');
const { generateHTMLSubInvoice } = require('../htmlGenerator');
const { buildEffectiveInteriorInvoices } = require('../interiorReceivables');
const sale = { id: 1, faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11, biaya_assembly: 1000, biaya_kirim: 2000,
  items: [{ qty: 3, harga_satuan: 10005, subtotal: 30015 }, { qty: 2, harga_satuan: 20005, subtotal: 40010 }] };

test('Sub-Invoice and ledger use exact Proforma nominal instead of rounded percentage', async () => {
  const term = { tipe: 'DP', jumlah: 12345, persen: 15.3 };
  const doc = { id: 1, tanggal: '2026-01-10', penjualan_interior_id: 1, penjualan: sale, nomor_sub_invoice: 'SUB', terms: JSON.stringify([term]) };
  const html = generateHTMLSubInvoice(doc);
  expect(html.match(/>JUMLAH<\/td>\s*<td[^>]*>([^<]*)<\/td>/)?.[1]).toBe('Rp 12.345');
  const invoices = await buildEffectiveInteriorInvoices([], [doc], async () => { throw Error('No shipment invoice'); });
  expect(invoices[0]._ledgerAmount.total).toBe(12345);
  const allocation = interiorTerm(sale, term);
  expect(allocation.subtotal + allocation.ppn + allocation.costs.total).toBe(12345);
});

test('nominal-only and tiny nominal terms do not disappear when percentage rounds to zero', () => {
  expect(interiorTerm(sale, { tipe: 'DP', jumlah: 1, persen: 0 }).total).toBe(1);
  expect(interiorTerm(sale, { tipe: 'DP', jumlah: 12345 }).total).toBe(12345);
});

test.each([-1, 0, 'abc', Infinity, 999999999])('invalid nominal %s is rejected rather than creating a missing ledger entry', jumlah => {
  expect(() => validateInteriorTerms(sale, [{ tipe: 'DP', jumlah, persen: 30 }])).toThrow();
});

test('percentage-only legacy terms preserve invoice per-line rounding', () => {
  const result = interiorTerm(sale, { tipe: 'DP', persen: 30 });
  expect(result.total).toBe(Math.round(33318 * .3) + Math.round(44412 * .3) + 300 + 600);
});

test('multiple DP rows in one Sub-Invoice match its printed total without double counting reissue', async () => {
  const doc = { id: 1, tanggal: '2026-01-10', penjualan_interior_id: 1, penjualan: sale, nomor_sub_invoice: 'SUB', terms: JSON.stringify([{ tipe: 'DP', jumlah: 10000 }, { tipe: 'DP', jumlah: 20000 }]) };
  const html = generateHTMLSubInvoice(doc);
  expect(html.match(/>JUMLAH<\/td>\s*<td[^>]*>([^<]*)<\/td>/)?.[1]).toBe('Rp 30.000');
  const invoices = await buildEffectiveInteriorInvoices([], [doc, { ...doc, id: 2, tanggal: '2026-01-11', nomor_sub_invoice: 'SUB-REISSUE' }], async () => {});
  expect(invoices.reduce((sum, inv) => sum + inv._ledgerAmount.total, 0)).toBe(30000);
});
