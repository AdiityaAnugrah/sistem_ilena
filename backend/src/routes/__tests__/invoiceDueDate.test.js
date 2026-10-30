const path = require('path');
const { invoiceFixture } = require('../../../tests/invoiceFixture.cjs');
const root = path.resolve(__dirname, '../../../..');
const { resolveInvoiceDates } = require('../../utils/invoiceDueDate');

describe.each(['penjualanOffline', 'penjualanOnline', 'penjualanInterior'])('%s invoice due date', route => {
  const create = async (body) => invoiceFixture(root, route).call('post', '/:id/invoice', { surat_jalan_ids: [1], ...body });
  test('old clients retain default 14 days', async () => {
    const result = await create({ tanggal: '2026-10-30' });
    expect(result.status).toBe(201);
    expect(result.writes[0]).toMatchObject({ tanggal: '2026-10-30', jatuh_tempo: '2026-11-13' });
  });
  test.each(['2026-10-30', '2026-11-06', '2026-11-29', '2027-01-15'])('saves selected date %s', async jatuh_tempo => {
    const result = await create({ tanggal: '2026-10-30', jatuh_tempo });
    expect(result.status).toBe(201);
    expect(result.writes[0].jatuh_tempo).toBe(jatuh_tempo);
  });
  test.each(['2026-10-29', '2026-02-30', '2026-13-01', 'tomorrow', '', null, 14])('rejects invalid due date %s before writes/numbering', async jatuh_tempo => {
    const result = await create({ tanggal: '2026-10-30', jatuh_tempo });
    expect(result.status).toBe(400);
    expect(result.writes).toEqual([]);
    expect(result.numbers).toBe(0);
  });
  test('rejects invalid document date', async () => {
    const result = await create({ tanggal: '2026-02-30' });
    expect(result.status).toBe(400);
    expect(result.writes).toEqual([]);
  });
});

describe('Sub-Invoice due date and reprint', () => {
  test('saves custom date without a Surat Jalan', async () => {
    const result = await invoiceFixture(root, 'dokumen').call('put', '/proforma/:id/sub-invoice/surat-jalan', {
      surat_jalan_ids: [], jatuh_tempo: '2026-11-29',
    });
    expect(result.status).toBe(200);
    expect(result.writes[0]).toMatchObject({ sub_invoice_sj_ids: null, jatuh_tempo: '2026-11-29' });
  });
  test.each(['2026-10-29', '2026-02-30', '', null])('rejects invalid Sub-Invoice due date %s', async jatuh_tempo => {
    const result = await invoiceFixture(root, 'dokumen').call('put', '/proforma/:id/sub-invoice/surat-jalan', { surat_jalan_ids: [], jatuh_tempo });
    expect(result.status).toBe(400);
    expect(result.writes).toEqual([]);
  });
  test('omitted date defaults to 14 days for a new Sub-Invoice', async () => {
    const result = await invoiceFixture(root, 'dokumen').call('put', '/proforma/:id/sub-invoice/surat-jalan', { surat_jalan_ids: [] });
    expect(result.writes[0].jatuh_tempo).toBe('2026-11-13');
  });
  test('omitted date preserves previously selected date', async () => {
    const result = await invoiceFixture(root, 'dokumen', { savedDate: '2026-11-29' }).call('put', '/proforma/:id/sub-invoice/surat-jalan', { surat_jalan_ids: [] });
    expect(result.writes[0].jatuh_tempo).toBe('2026-11-29');
  });
  test('print generation preserves selected date', async () => {
    const fixture = invoiceFixture(root, 'dokumen', { savedDate: '2026-11-29' });
    const result = await fixture.call('get', '/proforma/:id/sub-invoice/print');
    expect(result.status).toBe(200);
    expect(fixture.proforma.jatuh_tempo).toBe('2026-11-29');
  });
  test('reprint does not update existing due date or number', async () => {
    const result = await invoiceFixture(root, 'dokumen', { savedDate: '2026-11-29', numbered: true }).call('get', '/proforma/:id/sub-invoice/print');
    expect(result.status).toBe(200);
    expect(result.writes).toEqual([]);
    expect(result.numbers).toBe(0);
  });
});

describe('calendar arithmetic', () => {
  test.each([['2026-12-25', '2027-01-08'], ['2028-02-20', '2028-03-05'], ['2026-03-01', '2026-03-15']])('%s + 14 days = %s', (tanggal, due) => {
    expect(resolveInvoiceDates({ tanggal }).jatuh_tempo).toBe(due);
  });
});

describe('printed document due date', () => {
  const { generateHTMLInvoice, generateHTMLSubInvoice } = require('../../utils/htmlGenerator');
  const doc = {
    nomor_invoice: 'INV-FIXTURE', nomor_sub_invoice: 'SUB-FIXTURE', tanggal: '2026-10-30',
    jatuh_tempo: '2026-11-29', terms: '[]', penjualan: { items: [], faktur: 'NON_FAKTUR' },
  };
  test.each([['offline/interior', false], ['online', true]])('%s invoice uses stored custom date', (_source, online_document) => {
    expect(generateHTMLInvoice({ ...doc, online_document })).toContain('29 November 2026');
  });
  test('Sub-Invoice uses stored custom date', () => {
    expect(generateHTMLSubInvoice(doc)).toContain('29 November 2026');
  });
});
