const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

// Exercise the real route handler with isolated in-memory models, never app startup/DB.
function invoiceFixture(root, routeName, options = {}) {
  const routes = [];
  const writes = [];
  let numbers = 0;
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    router[method] = (url, ...handlers) => routes.push({ method, url, handler: handlers.at(-1) });
  }
  const sale = { id: 1, tipe: 'PENJUALAN', faktur: 'NON_FAKTUR', status: 'ACTIVE', is_test: 0, update: async () => {} };
  const proforma = {
    id: 2, tanggal: '2026-10-30', jatuh_tempo: options.savedDate || null, penjualan_interior_id: 1,
    nomor_proforma: 'PRO-FIXTURE', nomor_sub_invoice: options.numbered ? 'INV-EXISTING' : null,
    penjualan: { ...sale, nama_customer: 'Fixture', items: [], suratJalans: [] },
    async update(data) { writes.push({ model: 'ProformaInvoice', ...data }); Object.assign(this, data); },
    toJSON() { return { ...this }; },
  };
  const models = new Proxy({}, { get(target, name) {
    if (!target[name]) target[name] = {
      findByPk: async () => name === 'ProformaInvoice' ? proforma : sale,
      findOne: async () => null,
      findAll: async () => [],
      count: async () => 1,
      create: async data => { writes.push({ model: name, ...data }); return { id: 3, ...data }; },
    };
    return target[name];
  } });
  const filename = path.join(root, 'backend/src/routes', `${routeName}.js`);
  // Dependencies stay in the actual workspace when loading backup/rollback source trees.
  const localRequire = createRequire(path.resolve(__dirname, '../src/routes', `${routeName}.js`));
  const noop = (_req, _res, next) => next();
  const imports = {
    express: { Router: () => router },
    '../models': models,
    '../models/BarangTest': {},
    '../middleware/auth': { authenticate: noop, authenticatePrint: noop, requireDev: noop, requireAdminOrAbove: noop },
    '../middleware/logger': { logAction: async () => {} },
    '../socket': { emitDataUpdated() {} },
    '../utils/generateNomor': new Proxy({}, { get: () => async () => `INV-${++numbers}` }),
    '../utils/pdfGenerator': {}, '../utils/mailer': {}, '../utils/htmlToPdf': {},
    '../utils/htmlGenerator': { generateHTMLSubInvoice: data => JSON.stringify({ jatuh_tempo: data.jatuh_tempo }) },
    ...options.imports,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => Object.hasOwn(imports, name) ? imports[name]
      : name === '../utils/invoiceDueDate' ? require(path.join(root, 'backend/src/utils/invoiceDueDate.js')) : localRequire(name),
    module: { exports: {} }, __dirname: path.dirname(filename), process, console, Buffer,
  }, { filename });

  async function call(method, url, body = {}) {
    const route = routes.find(row => row.method === method && row.url === url);
    if (!route) throw new Error(`Route missing: ${method} ${url}`);
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }, type() { return this; }, send(data) { this.body = data; return this; },
      setHeader() {}, removeHeader() {} };
    await route.handler({ params: { id: '1' }, body, query: {}, user: { id: 1, role: 'ADMIN' }, ip: '127.0.0.1' }, response);
    return { status: response.statusCode, body: response.body, writes, numbers };
  }
  return { call, writes, proforma, models };
}

module.exports = { invoiceFixture };
