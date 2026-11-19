const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Box } = require('@mui/material');

const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/penjualan/interior/page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let fragment;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.getText(ast).includes('aria-label="Rincian total invoice"')) fragment = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(fragment, 'Invoice breakdown is present in list footer');
const output = { exports: {} };
const code = ts.transpileModule(`module.exports = function Summary({summary}: any) { return (${fragment}); };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { module: output, exports: output.exports, require, Box,
  formatRupiah: value => 'Rp ' + Number(value || 0).toLocaleString('id-ID') });
const render = summary => renderToStaticMarkup(React.createElement(output.exports, { summary }));
const amounts = html => [...html.matchAll(/<dd[^>]*>(.*?)<\/dd>/g)].map(match => match[1]);

test('footer renders API DPP, PPN and gross in that order without taxing a second time', () => {
  const html = render({ totalNilai: 1000000, totalPpn: 110000, totalTagihan: 1110000 });
  assert.deepEqual(amounts(html), ['Rp 1.000.000', 'Rp 110.000', 'Rp 1.110.000']);
  assert.match(html, /DPP \(sebelum PPN\)/);
  assert.match(html, /Jumlah keseluruhan \(DPP \+ PPN\)/);
  assert.match(html, /<dl[^>]*aria-label="Rincian total invoice"/);
});

test('non-faktur footer shows zero PPN with gross equal to DPP', () => {
  assert.deepEqual(amounts(render({ totalNilai: 250000, totalPpn: 0, totalTagihan: 250000 })), ['Rp 250.000', 'Rp 0', 'Rp 250.000']);
});

test('empty filtered result renders three zeros', () => {
  assert.deepEqual(amounts(render({ totalNilai: 0, totalPpn: 0, totalTagihan: 0 })), ['Rp 0', 'Rp 0', 'Rp 0']);
});
