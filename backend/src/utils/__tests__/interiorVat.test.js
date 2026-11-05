const { interiorItemAmounts, interiorGoodsAmounts, interiorTermAmounts } = require('../interiorVat');
const { interiorTotal } = require('../interiorCosts');
const { generateHTMLInvoice, generateHTMLProforma, generateHTMLSubInvoice } = require('../htmlGenerator');
const { buildEffectiveInteriorInvoices } = require('../interiorReceivables');
const tax = { faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11 };
const item = { qty: 3, harga_satuan: 10005, subtotal: 30015 };
const sale = { id: 1, ...tax, items: [item] };
const doc = { id: 1, penjualan_interior_id: 1, tanggal: '2026-11-05', nomor_invoice: 'INV-FIXTURE', nomor_proforma: 'PRO-FIXTURE', nomor_sub_invoice: 'SUB-FIXTURE', terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]', penjualan: sale };

describe('Interior VAT uses rounded inclusive unit prices', () => {
  test('round inclusive unit before multiplying qty, not after summing goods', () => {
    expect(interiorItemAmounts(item, tax)).toEqual({ subtotal: 30015, ppn: 3303, total: 33318 });
    expect(interiorTotal(sale).total).toBe(33318);
    expect(Math.round(30015 * 1.11)).toBe(33317);
  });
  test('multiple lines sum their individual invoice amounts', () => {
    expect(interiorGoodsAmounts([item, { qty: 2, harga_satuan: 20005 }], tax)).toEqual({ subtotal: 70025, ppn: 7705, total: 77730 });
  });
  test.each([10, 11])('matches invoice formula for PPN %s%%', ppn_persen => {
    const sale = { pakai_ppn: 1, ppn_persen };
    for (const price of [10005, 12345.67, 5214740, 99999.5]) {
      expect(interiorItemAmounts({ harga_satuan: price, qty: 7 }, sale).total).toBe(Math.round(price * (1 + ppn_persen / 100)) * 7);
    }
  });
  test('no VAT leaves goods and optional assembly/shipping rules intact', () => {
    expect(interiorTotal({ ...sale, pakai_ppn: 0, biaya_assembly: 100000, biaya_kirim: 200000 })).toMatchObject({ ppn: 0, total: 330015 });
    expect(interiorTotal({ ...sale, biaya_assembly: 100000, biaya_kirim: 200000 }).total).toBe(333318);
  });
  test('legacy subtotal-only item still works', () => {
    expect(interiorGoodsAmounts([{ qty: 3, subtotal: 30015 }], tax).total).toBe(33318);
  });
  test('partial delivery and returned quantity use the same unit rounding', () => {
    expect(interiorItemAmounts(item, tax, 1).total).toBe(11106);
    expect(interiorItemAmounts(item, tax, 2).total).toBe(22212);
    expect(interiorItemAmounts(item, tax, 0).total).toBe(0);
  });
  test('missing item yields zero rather than crashing a legacy report', () => {
    expect(interiorItemAmounts(null, null, 0).total).toBe(0);
  });
  test('30% term allocates the VAT-inclusive line without taxing the term again', () => {
    expect(interiorTermAmounts([item], tax, 30)).toEqual({ subtotal: 9005, total: 9995, ppn: 990 });
  });
});

describe('Interior invoice, proforma and Sub-Invoice totals agree', () => {
  test('full project documents match the existing invoice result', () => {
    const invoice = generateHTMLInvoice({ ...doc, ppn_persen: 0, penjualan: { ...sale, items: [{ ...item, harga_satuan: 11106, subtotal: 33318 }] } });
    expect(invoice).toContain('33.318');
    expect(generateHTMLProforma(doc)).toContain('33.318');
    expect(generateHTMLSubInvoice(doc)).toContain('33.318');
    expect(generateHTMLProforma(doc)).not.toContain('33.317');
  });
  test('30% Sub-Invoice matches the effective receivable', async () => {
    const termDoc = { ...doc, terms: '[{"tipe":"DP","persen":30}]' };
    const result = await buildEffectiveInteriorInvoices([], [termDoc], async () => {});
    expect(result[0]._ledgerAmount).toEqual({ subtotal: 9005, ppn: 990, total: 9995 });
    expect(generateHTMLSubInvoice(termDoc)).toContain('9.995');
  });
  test('full-settlement terms do not double-count a previous DP', async () => {
    const dp = { ...doc, terms: '[{"tipe":"DP","persen":30}]' };
    const full = { ...doc, id: 2, tanggal: '2026-11-06' };
    const result = await buildEffectiveInteriorInvoices([], [dp, full], async () => {});
    expect(result.reduce((sum, row) => sum + row._ledgerAmount.total, 0)).toBe(33318);
  });
});
