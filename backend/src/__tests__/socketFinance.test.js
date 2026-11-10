const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('finance subscription preserves presence room and forwards only an invalidation signal', () => {
  let connection;
  const sent = [], joined = [], left = [], handlers = {};
  const io = { use() {}, on(name, callback) { if (name === 'connection') connection = callback; }, to(room) { return { emit: (name, payload) => sent.push({ room, name, payload }) }; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../socket.js'), 'utf8'), {
    module, require: name => name === 'socket.io' ? { Server: function () { return io; } } : {},
  });
  module.exports.init({}, []);
  connection({ id: 'socket', user: { id: 1, nama: 'Fixture' }, on: (name, cb) => { handlers[name] = cb; }, join: room => joined.push(room), leave: room => left.push(room) });
  handlers['room:join']({ room: 'penjualan-offline:1' });
  handlers['room:subscribe']({ room: 'finance-updates' });
  expect(joined).toEqual(['penjualan-offline:1', 'finance-updates']);
  expect(left).toEqual([]);
  handlers['room:subscribe']({ room: 'arbitrary-room' });
  expect(joined).toHaveLength(2);
  module.exports.emitDataUpdated('penjualan-online:2', { orderId: 'PRIVATE', updatedBy: 1 });
  const finance = sent.find(e => e.name === 'data:updated' && e.room === 'finance-updates');
  expect(finance.payload).toEqual({ room: 'finance-updates' });
  handlers['room:unsubscribe']({ room: 'finance-updates' });
  expect(left).toEqual(['finance-updates']);
});
