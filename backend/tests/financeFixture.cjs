const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');

const modelNames = ['ChartOfAccount', 'PenjualanOffline', 'PenjualanOfflineItem', 'PembayaranOffline', 'SuratJalan', 'Invoice', 'SuratPengantar', 'SuratPengantarSub', 'ReturOffline', 'MutasiDisplay', 'MutasiDisplayItem', 'PenjualanInterior', 'PenjualanInteriorItem', 'PembayaranInterior', 'InvoiceInterior', 'ProformaInvoice', 'SuratJalanInterior', 'SuratJalanInteriorItem', 'ReturSJInterior', 'SuratPengantarInterior', 'SuratPengantarInteriorItem', 'PenjualanOnline', 'PenjualanOnlineItem', 'PembayaranOnline', 'InvoiceOnline', 'SuratJalanOnline', 'ReturOnline'];
function models() {
  const result = Object.fromEntries(modelNames.map(name => [name, {
    findAll: async () => [], findAndCountAll: async () => ({ count: 0, rows: [] }),
    count: async () => 0, findOrCreate: async () => [{}, false],
  }]));
  result.sequelize = { fn: (...args) => args, col: value => value };
  return result;
}
function route(name, m, sourceRoot = root) {
  const file = path.join(sourceRoot, 'backend/src/routes', `${name}.js`);
  const native = createRequire(path.join(root, 'backend/src/routes', `${name}.js`));
  const output = { exports: {} };
  const utilityCache = new Map();
  function utility(relative) {
    if (utilityCache.has(relative)) return utilityCache.get(relative).exports;
    const filename = path.join(sourceRoot, relative);
    const dependency = { exports: {} };
    utilityCache.set(relative, dependency);
    const originalRequire = createRequire(path.join(root, relative));
    const requireUtility = id => {
      const target = path.normalize(path.join(path.dirname(relative), id.endsWith('.js') ? id : id + '.js'));
      if (id.startsWith('.') && fs.existsSync(path.join(sourceRoot, target))) return utility(target);
      return originalRequire(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`, { filename })(requireUtility, dependency, dependency.exports);
    return dependency.exports;
  }
  const requireMock = id => {
    if (id === '../models') return m;
    if (id === '../models/BarangTest') return {};
    if (id === '../middleware/auth') return { authenticate() {}, requireAdminOrAbove() {} };
    if (id === '../middleware/logger') return { logAction: async () => {} };
    if (id === '../socket') return { emitDataUpdated(...args) { (m.__events ||= []).push(args); } };
    if (id === '../utils/generateNomor') return new Proxy({}, { get: () => async () => 'FIXTURE-REF' });
    if (id === 'fs') return { ...fs, existsSync: () => true };
    if (sourceRoot !== root && id.startsWith('../utils/')) {
      const relative = path.normalize(path.join('backend/src/routes', id + '.js'));
      if (fs.existsSync(path.join(sourceRoot, relative))) return utility(relative);
    }
    return native(id);
  };
  vm.runInThisContext(`(function(require,module,exports,__dirname,__filename){${fs.readFileSync(file, 'utf8')}\n})`, { filename: file })(requireMock, output, output.exports, path.dirname(file), file);
  return output.exports;
}
async function respond(router, url, query = {}, body = {}, method = 'get') {
  const layer = router.stack.find(x => x.route?.path === url && x.route.methods[method]);
  assert.ok(layer, `Missing route ${method} ${url}`);
  const response = { code: 200, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
  await layer.route.stack.at(-1).handle({ query, body, user: { role: 'ADMIN', id: 1 }, params: { id: 1 }, ip: 'fixture' }, response);
  return response;
}

async function invoke(...args) { const res = await respond(...args); assert.ok(res.code < 400, JSON.stringify(res.body)); return res.body; }
module.exports = { models, route, invoke, respond };
