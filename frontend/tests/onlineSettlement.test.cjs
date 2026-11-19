const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function component(values, fail = false) {
  const calls = [], messages = [];
  let next = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/keuangan/OnlineSettlementPanel.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(code, { module: result, exports: result.exports, Intl, Date, Number,
    require(name) {
      if (name === 'react') return { ...React, useState: () => [values[next++], () => {}] };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@/lib/api') return { default: { post: async (...args) => { calls.push(args); if (fail) throw { response: { data: { message: 'Saldo tidak cukup' } } }; } } };
      if (name === '@/lib/utils') return { formatDate: String, formatRupiah: value => 'Rp ' + Number(value).toLocaleString('id-ID') };
      if (name === 'react-hot-toast') return { default: { success: text => messages.push(text), error: text => messages.push(text) } };
      if (name.endsWith('/DateInput')) return { default: 'input' };
      if (name.endsWith('/card')) return { Card: 'section', CardHeader: 'header', CardTitle: 'h2', CardContent: 'div' };
      if (name.endsWith('/button')) return { Button: 'button' };
      if (name.endsWith('/label')) return { Label: 'label' };
      if (name.endsWith('/input')) return { Input: 'input' };
      throw Error(name);
    },
  });
  let saved = 0;
  const tree = result.exports.default({ saleId: '7', rows: [], saldo: 100000, onSaved: async () => { saved++; } });
  function find(node, type) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, type); if (found) return found; }
  }
  return { tree, calls, messages, find: type => find(tree, type), saved: () => saved };
}

test('payout panel renders fields and sends dated gross+fee/reference, not legacy net income', async () => {
  const c = component([true, false, '2026-01-10', 'BANK-7', '100000', '10000']);
  const html = renderToStaticMarkup(c.tree);
  for (const label of ['Tanggal masuk bank', 'Referensi bank / pencairan', 'Saldo gateway yang dicairkan', 'Potongan biaya']) {
    assert.ok(html.includes(label));
  }
  await c.find('form').props.onSubmit({ preventDefault() {} });
  assert.equal(c.calls[0][0], '/penjualan-online/7/pencairan');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls[0][1])), { tanggal: '2026-01-10', referensi: 'BANK-7', jumlah_bruto: 100000, biaya: 10000 });
  assert.equal(c.saved(), 1);
});

test('payout error is visible and does not refresh as success', async () => {
  const c = component([true, false, '2026-01-10', 'BANK-7', '100000', '10000'], true);
  await c.find('form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(c.messages, ['Saldo tidak cukup']);
  assert.equal(c.saved(), 0);
});

test('empty reference, invalid fee or saving state prevents submission', async () => {
  for (const values of [[true, false, '2026-01-10', '', '100000', '0'], [true, false, '2026-01-10', 'BANK', '100000', '100001'], [true, true, '2026-01-10', 'BANK', '100000', '0']]) {
    const c = component(values);
    await c.find('form').props.onSubmit({ preventDefault() {} });
    assert.equal(c.calls.length, 0);
  }
});
