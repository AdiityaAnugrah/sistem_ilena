const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const file = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/keuangan/page.tsx'), 'utf8');
function load(names) {
  const tree = ts.createSourceFile('page.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(tree));
    if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (names.includes(d.name.getText(tree))) found.set(d.name.getText(tree), node.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const context = { React, filterLabel: 'Semua Data', formatRupiah: n => 'Rp' + n, formatDate: String };
  const text = names.map(n => { assert.ok(found.has(n)); return found.get(n); }).join('\n');
  vm.runInNewContext(ts.transpileModule(`${text}\nglobalThis.actual = {${names.join(',')}};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
  return context.actual;
}
test('Interior export keeps net invoice amount separate from gross outstanding', () => {
  const { buildInteriorSheet } = load(['escapeXml', 'excelCell', 'sheetName', 'money', 'worksheetXml', 'buildInteriorSheet']);
  const xml = buildInteriorSheet([{ id: 1, tanggal: '2026-11-01', nama_customer: 'Customer', no_po: 'PO', faktur: 'FAKTUR', status: 'ACTIVE',
    grandTotal: 1000000, total_tagihan: 1110000, terbayar: 500000, sisa: 610000, persen: 45, lunas: false }]);
  assert.ok(xml.includes('Nilai sebelum PPN'));
  assert.ok(xml.includes('ss:Type="Number">1000000</Data>'));
  assert.ok(xml.includes('ss:Type="Number">610000</Data>'));
  assert.ok(!xml.includes('ss:Type="Number">1110000</Data>'));
});
test('actual summary card renders net invoice label/value without adding tax', () => {
  const { SummaryCard } = load(['SummaryCard']);
  const html = renderToStaticMarkup(React.createElement(SummaryCard, { label: 'Penjualan sebelum PPN', value: 'Rp1.000.000', color: '#0f172a' }));
  assert.ok(html.includes('Penjualan sebelum PPN'));
  assert.ok(html.includes('Rp1.000.000'));
  assert.ok(!html.includes('Rp1.110.000'));
});
