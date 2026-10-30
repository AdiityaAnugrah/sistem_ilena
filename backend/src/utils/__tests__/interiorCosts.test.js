const { optionalCost, interiorCosts, interiorTotal, invoiceCosts } = require('../interiorCosts');
const { generateHTMLInvoice, generateHTMLProforma, generateHTMLSubInvoice } = require('../htmlGenerator');
const { buildEffectiveInteriorInvoices } = require('../interiorReceivables');
const { migrateInteriorCosts } = require('../../../scripts/migrate-interior-costs');

const sale = { id: 1, faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11, biaya_assembly: 100000, biaya_kirim: 200000, items: [{ qty: 2, harga_satuan: 500000, subtotal: 1000000 }] };
const doc = penjualan => ({ id: 1, penjualan_interior_id: 1, nomor_invoice: 'INV-FIXTURE', nomor_proforma: 'PRO-FIXTURE', nomor_sub_invoice: 'SUB-FIXTURE', tanggal: '2026-10-30', terms: '[{"tipe":"DP","persen":30}]', penjualan });

describe('optional Interior costs', () => {
  test.each([undefined, null, '', '  ', 0, '0'])('empty/zero %s is omitted', value => expect(optionalCost(value, 'Biaya')).toBeNull());
  test.each([-1, '-1', 'abc', true, [], {}, Infinity, 1000000000])('rejects invalid cost %s', value => {
    expect(() => optionalCost(value, 'Biaya')).toThrow();
  });
  test('accepts numeric and decimal input', () => {
    expect(optionalCost('100000', 'Biaya')).toBe(100000);
    expect(optionalCost('1200.50', 'Biaya')).toBe(1200.5);
  });
  test('adds costs separately without changing goods VAT', () => {
    expect(interiorTotal(sale)).toMatchObject({ subtotal: 1000000, ppn: 110000, biaya_assembly: 100000, biaya_kirim: 200000, total: 1410000 });
  });
  test('legacy projects without costs retain old total', () => {
    expect(interiorTotal({ ...sale, biaya_assembly: null, biaya_kirim: null }).total).toBe(1110000);
  });
  test('partial shipment/term only bills a proportional share', () => {
    expect(invoiceCosts(sale, 500000)).toEqual({ biaya_assembly: 50000, biaya_kirim: 100000, total: 150000 });
    expect(interiorCosts(sale, 0.3).total).toBe(90000);
  });
});

describe.each([['invoice', data => generateHTMLInvoice({ ...data, ppn_persen: 11 })], ['proforma', generateHTMLProforma], ['sub-invoice', generateHTMLSubInvoice]])('%s optional fee rows', (_name, render) => {
  test.each([undefined, null, 0, '0'])('omits labels when fees are %s', value => {
    const html = render(doc({ ...sale, biaya_assembly: value, biaya_kirim: value }));
    expect(html).not.toContain('BIAYA ASSEMBLY');
    expect(html).not.toContain('BIAYA KIRIM');
  });
  test('renders both optional labels when filled', () => {
    const html = render(doc(sale));
    expect(html).toContain('BIAYA ASSEMBLY');
    expect(html).toContain('BIAYA KIRIM');
  });
  test('one fee does not make the other fee visible', () => {
    const html = render(doc({ ...sale, biaya_kirim: null }));
    expect(html).toContain('BIAYA ASSEMBLY');
    expect(html).not.toContain('BIAYA KIRIM');
  });
});

describe('Interior installments and receivables', () => {
  test('30% Sub-Invoice includes 30% costs and goods VAT', async () => {
    const rows = await buildEffectiveInteriorInvoices([], [doc(sale)], async () => {});
    expect(rows[0]._ledgerAmount).toEqual({ subtotal: 390000, ppn: 33000, total: 423000 });
    expect(generateHTMLSubInvoice(doc(sale))).toContain('423.000');
  });
  test('DP plus full settlement never doubles project costs', async () => {
    const docs = [doc(sale), { ...doc(sale), id: 2, tanggal: '2026-11-01', terms: '[{"tipe":"PELUNASAN_PENUH","persen":100}]' }];
    const rows = await buildEffectiveInteriorInvoices([], docs, async () => {});
    expect(rows.reduce((sum, row) => sum + row._ledgerAmount.total, 0)).toBe(1410000);
  });
});

describe('idempotent optional columns migration', () => {
  test('check mode never alters the database', async () => {
    const db = { query: jest.fn().mockResolvedValue([[]]) };
    expect((await migrateInteriorCosts(db)).ready).toBe(false);
    expect(db.query.mock.calls.every(([sql]) => sql.startsWith('SHOW'))).toBe(true);
  });
  test('adds nullable columns once and leaves existing rows untouched', async () => {
    let columns = [];
    const db = { query: jest.fn(async sql => {
      if (sql.startsWith('ALTER')) columns = ['biaya_assembly', 'biaya_kirim'].map(Field => ({ Field, Type: 'decimal(15,2)', Null: 'YES', Default: null }));
      return [columns];
    }) };
    expect((await migrateInteriorCosts(db, true)).ready).toBe(true);
    expect((await migrateInteriorCosts(db, true)).added).toEqual([]);
    expect(db.query.mock.calls.filter(([sql]) => sql.startsWith('ALTER'))).toHaveLength(1);
  });
});
