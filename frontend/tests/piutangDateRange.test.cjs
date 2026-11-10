const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/piutang-usaha/page.tsx'), 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function load(names, context = {}) {
  const declarations = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.set(node.name.text, node.getText(tree));
    if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (names.includes(d.name.getText(tree))) declarations.set(d.name.getText(tree), node.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const code = names.map(n => { assert.ok(declarations.has(n)); return declarations.get(n); }).join('\n');
  vm.runInNewContext(ts.transpileModule(`${code}\nglobalThis.actual = {${names.join(',')}};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.actual;
}
test('date guard matches the backend for leap days, malformed dates and reversed ranges', () => {
  const { dateRangeError } = load(['dateRangeError']);
  const { financeDateRangeError } = require('../../backend/src/utils/financeDateRange');
  for (const [from, to] of [['', ''], ['2026-11-01', '2026-11-10'], ['2028-02-29', '2028-03-01'], ['2026-02-31', ''], ['2025-02-29', ''], ['2026-11-10', '2026-11-01'], ['10/11/2026', '']]) {
    assert.equal(Boolean(dateRangeError(from, to)), Boolean(financeDateRangeError({ from, to })));
  }
});
test('invalid filter aborts prior request, reports validation and sends no report request', async () => {
  let calls = 0, error = '', loading;
  const previous = new AbortController();
  const context = { from: '2026-11-10', to: '2026-11-01', AbortController, Error,
    requestId: { current: 0 }, requestController: { current: previous },
    useCallback: fn => fn, setLoading: value => { loading = value; }, setLoadError: value => { error = value; },
    viewPage: 'interior', tab: 'rekap', fetchRekap: async () => { calls++; }, fetchDetail() {}, fetchUangMuka() {},
    uangMukaPage: 1, selectedUangMuka: null, rekapPage: 1, detailPage: 1, selectedCustomer: null,
  };
  const { fetchData } = load(['dateRangeError', 'fetchData'], context);
  await fetchData();
  assert.equal(calls, 0); assert.equal(previous.signal.aborted, true); assert.equal(loading, false);
  assert.match(error, /Tanggal awal/);
});
test('invalid range never exports stale data or invokes the export API', async () => {
  let error;
  const { exportCsv } = load(['dateRangeError', 'exportCsv'], { from: '2026-02-31', to: '', setLoadError: e => { error = e; } });
  await exportCsv();
  assert.match(error, /Tanggal tidak valid/);
});
