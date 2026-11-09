const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../..');

function transpile(code) {
  return ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}

function createTableRenderer(sourceRoot = root) {
  const helper = { exports: {} };
  vm.runInNewContext(transpile(fs.readFileSync(path.join(sourceRoot, 'frontend/src/lib/interiorVat.ts'), 'utf8')), { module: helper, exports: helper.exports });
  const source = fs.readFileSync(path.join(sourceRoot, 'frontend/src/app/dashboard/penjualan/interior/[id]/page.tsx'), 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let table;
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const text = node.getText(ast);
      if (text.includes('>Daftar Barang</h2>') && text.includes('<table') && (!table || text.length < table.length)) table = text;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!table) throw new Error('Daftar Barang card not found');
  const oldStart = source.indexOf('  const subtotal = data.items?');
  const newStart = source.indexOf('  const { ppn, total: goodsTotal } = ');
  const start = newStart >= 0 ? newStart : oldStart;
  const end = source.indexOf('\n  return (', start);
  if (start < 0 || end < 0) throw new Error('Detail totals block not found');
  const component = { exports: {} };
  vm.runInNewContext(transpile(`function Table({data}: any) { ${source.slice(start, end)} return (${table}); } module.exports = Table;`), {
    module: component, exports: component.exports,
    require: name => { if (name === 'react/jsx-runtime') return jsx; throw new Error(`Unexpected import ${name}`); },
    ...helper.exports,
    Package: 'svg',
    formatRupiah: value => 'Rp ' + Math.round(Number(value || 0)).toLocaleString('id-ID'),
  });
  return {
    ...helper.exports,
    render: data => renderToStaticMarkup(React.createElement(component.exports, { data })),
  };
}

module.exports = { createTableRenderer };
