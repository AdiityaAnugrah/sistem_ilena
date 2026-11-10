const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, names, context) {
  const file = fs.readFileSync(path.join(root, relative), 'utf8');
  const tree = ts.createSourceFile('page.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) {
      const name = d.name.getText(tree);
      if (names.includes(name)) declarations.set(name, node.getText(tree));
    }
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.getText(tree))) declarations.set(node.name.getText(tree), node.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const name of names) assert.ok(declarations.has(name), `Missing actual declaration ${name}`);
  context.globalThis = context;
  const source = names.map(n => declarations.get(n)).join('\n') + `\nglobalThis.functions = {${names.join(',')}};`;
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.functions;
}

function finance(api) {
  const downloads = [], errors = {};
  const context = { api, URLSearchParams, from: '2026-01-01', to: '2026-12-31', formatDate: String, formatRupiah: String,
    setExportLoading() {}, setLoadErrors(update) { Object.assign(errors, update(errors)); },
    downloadExcelXml(name, xml) { downloads.push({ name, xml }); } };
  const functions = load('src/app/dashboard/keuangan/page.tsx', ['escapeXml', 'excelCell', 'sheetName', 'money', 'worksheetXml', 'buildWorkbookXml', 'filterLabel', 'fetchAllKeuangan', 'buildSummarySheet', 'buildOfflinePenjualanSheet', 'buildOfflineDisplaySheet', 'buildInteriorSheet', 'handleExport'], context);
  return { functions, downloads, errors };
}

test('combined workbook contains all Online pages, escaped text, zero income and summary', async () => {
  const calls = [];
  const f = finance({ async get(url) {
    calls.push(url);
    const u = new URL(url, 'http://fixture');
    if (!u.pathname.endsWith('/online')) return { data: { summary: {}, list: [], totalPages: 1 } };
    const page = Number(u.searchParams.get('page'));
    return { data: { summary: { totalNilai: 3000, totalPendapatanBersih: 0 }, totalPages: 3, list: [{ id_pesanan: `ONLINE_PAGE_${page}`, tanggal: '2026-01-10', nama_pelanggan: '<Customer&>', channel: 'WEBSITE', status: 'SELESAI', total_awal: 1000, total_retur: 0, total: 1000, pendapatan_bersih: 0, selisih: 1000 }] } };
  } });
  await f.functions.handleExport('gabungan');
  assert.equal(f.downloads.length, 1);
  const xml = f.downloads[0].xml;
  assert.match(xml, /Worksheet ss:Name="Online"/);
  for (let i = 1; i <= 3; i++) assert.ok(xml.includes(`ONLINE_PAGE_${i}`));
  assert.ok(xml.includes('&lt;Customer&amp;&gt;'));
  assert.ok(xml.includes('Nilai Online Setelah Retur'));
  assert.equal(calls.filter(c => c.includes('/online?')).length, 3);
});

test('Online export is available independently and failed pages do not download incomplete files', async () => {
  const f = finance({ async get() { throw Error('offline'); } });
  await f.functions.handleExport('online');
  assert.equal(f.downloads.length, 0);
  assert.match(f.errors.export, /Gagal mengekspor/);
});

test('Outstanding Display sends search to server and exports every filtered page', async () => {
  const requests = []; let csv; let rows = [];
  const context = { from: '', to: '', page: 1, limit: 20, search: 'CUSTOMER_PAGE_2', rows: [], requestId: { current: 0 },
    useMemo: fn => fn(), useCallback: fn => fn,
    setRows(value) { rows = value; }, setSummary() {}, setTotalPages() {}, setLoading() {}, setLoadError() {}, setExportError() {}, setExporting() {},
    api: { async get(url, { params }) {
      requests.push({ ...params });
      return { data: { list: [{ id: Number(params.page), nama_penerima: `CUSTOMER_PAGE_${params.page}`, nilaiSisa: 1000, nilaiTerjual: 0, nilaiTerjualBelumLunas: 0, nilaiTotal: 1000 }], totalPages: params.limit === 100 ? 3 : 1 } };
    } },
    Blob: class { constructor(parts) { csv = parts[0]; } }, URL: { createObjectURL() {}, revokeObjectURL() {} }, document: { createElement: () => ({ click() {} }) },
  };
  const functions = load('src/app/dashboard/piutang-display/page.tsx', ['params', 'fetchData', 'exportCsv'], context);
  await functions.fetchData();
  assert.equal(requests[0].search, 'CUSTOMER_PAGE_2');
  assert.equal(rows.length, 1);
  await functions.exportCsv();
  assert.equal(csv.split('\n').length, 4);
  assert.ok(csv.includes('CUSTOMER_PAGE_3'));
  assert.equal(requests.filter(r => r.limit === 100).length, 3);
});

test('finance API failure exposes an error and stale responses cannot replace newer data', async () => {
  const pending = []; let error = ''; let data;
  const ctx = { useCallback: fn => fn, URLSearchParams, financeRequests: { current: { offline: 0 } }, setOfflineLoading() {},
    setLoadErrors(update) { error = update({}).offline; }, setOfflineData(value) { data = value; },
    api: { get: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  };
  const functions = load('src/app/dashboard/keuangan/page.tsx', ['fetchOffline'], ctx);
  const old = functions.fetchOffline(1, 'penjualan', '', '');
  const current = functions.fetchOffline(1, 'penjualan', '', '');
  pending[1].resolve({ data: 'LATEST' }); await current;
  pending[0].resolve({ data: 'STALE' }); await old;
  assert.equal(data, 'LATEST');
  const failed = functions.fetchOffline(1, 'penjualan', '', ''); pending[2].reject(Error('500')); await failed;
  assert.match(error, /Gagal memuat keuangan Offline/);
  assert.equal(data, 'LATEST');
});

test('finance refresh subscribes independently, re-subscribes on reconnect, debounces and cleans up', () => {
  const effects = [], emitted = [], handlers = new Map(); let scheduled; let refreshes = 0;
  const socket = { emit: (...args) => emitted.push(args), on: (name, fn) => handlers.set(name, fn), off: name => handlers.delete(name) };
  const module = { exports: {} };
  const context = { module, exports: module.exports,
    require: id => id === 'react' ? { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) } : { getSocket: () => socket },
    window: { addEventListener() {}, removeEventListener() {} }, setTimeout: fn => { scheduled = fn; return 1; }, clearTimeout: () => { scheduled = null; },
  };
  const file = fs.readFileSync(path.join(root, 'src/hooks/useFinanceRefresh.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  module.exports.useFinanceRefresh(() => refreshes++);
  const cleanups = effects.map(fn => fn());
  assert.equal(emitted[0][0], 'room:subscribe');
  assert.equal(emitted[0][1].room, 'finance-updates');
  handlers.get('connect')();
  assert.equal(emitted.length, 2);
  handlers.get('data:updated')(); handlers.get('data:updated')(); scheduled();
  assert.equal(refreshes, 1);
  cleanups.filter(Boolean).forEach(fn => fn());
  assert.equal(emitted.at(-1)[0], 'room:unsubscribe');
  assert.equal(handlers.size, 0);
});
