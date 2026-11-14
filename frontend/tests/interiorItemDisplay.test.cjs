const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTableRenderer } = require('./helpers/interiorTable.cjs');
const invoice = require('../../backend/src/utils/interiorVat');
const table = createTableRenderer();
const data = { pakai_ppn: 1, ppn_persen: 11, items: [{ id: 1, nama_barang: 'Contoh Barang', kode_barang: 'CONTOH', qty: 3, harga_satuan: 10005, subtotal: 30015, sudah_kirim: 1 }], pembayarans: [] };
const cells = html => [...html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/)[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1].replace(/<[^>]*>/g, ''));

test('actual Detail table shows the same inclusive unit and amount as Invoice', () => {
  const html = table.render(data);
  assert.deepEqual(cells(html), ['CONTOH', 'Contoh Barang', '1/3', 'Rp 11.106', 'Rp 33.318']);
  assert.match(html, /Harga Satuan/);
  assert.match(html, />Subtotal<\/td>/);
  assert.match(html, />PPN 11%<\/td>/);
  assert.doesNotMatch(html, /termasuk PPN|sudah termasuk/);
  assert.match(html, />Rp 3\.303</);
  assert.match(html, />Total<\/td><td[^>]*>Rp 33\.318<\/td>/);
});

test('VAT is not added a second time and optional charges are added once', () => {
  const html = table.render({ ...data, biaya_assembly: 100000, biaya_kirim: 200000 });
  assert.match(html, />Total<\/td><td[^>]*>Rp 333\.318<\/td>/);
  assert.doesNotMatch(html, /336\.621/);
});

test('VAT-disabled table retains base unit/amount and has no included-tax label', () => {
  const html = table.render({ ...data, pakai_ppn: 0 });
  assert.equal(cells(html)[3], 'Rp 10.005');
  assert.equal(cells(html)[4], 'Rp 30.015');
  assert.doesNotMatch(html, /sudah termasuk|termasuk PPN/);
  assert.match(html, />Total<\/td><td[^>]*>Rp 30\.015<\/td>/);
});

test('display-only calculations never mutate stored item prices/subtotals', () => {
  const input = structuredClone(data);
  const before = JSON.stringify(input);
  table.render(input);
  assert.equal(JSON.stringify(input), before);
});

test('frontend display matches Invoice for 48 price/qty/tax combinations', () => {
  for (const rate of [0, 10, 11]) for (const price of [10005, 12345.67, 500000, 99999.5]) for (const qty of [1, 2, 3, 7]) {
    const item = { harga_satuan: price, qty, subtotal: price * qty };
    const sale = { pakai_ppn: rate > 0, ppn_persen: rate };
    const shown = table.interiorItemAmounts(item, sale);
    const printed = invoice.interiorItemAmounts(item, sale);
    assert.equal(shown.total, printed.total);
    assert.equal(shown.inclusiveUnit, rate > 0 ? Math.round(price * (1 + rate / 100)) : price);
    assert.equal(JSON.stringify(table.interiorGoodsAmounts([item], sale)), JSON.stringify(invoice.interiorGoodsAmounts([item], sale)));
  }
});

test('legacy subtotal fallback and empty projects remain valid', () => {
  assert.equal(table.interiorItemAmounts({ qty: 3, subtotal: 30015 }, data).inclusiveUnit, 11106);
  const html = table.render({ ...data, items: [] });
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, />Total<\/td><td[^>]*>Rp 0<\/td>/);
});
