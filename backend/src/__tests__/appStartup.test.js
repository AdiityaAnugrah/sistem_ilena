const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runStartup(nodeEnv, connectionError) {
  const sequelize = {
    authenticate: jest.fn(() => connectionError ? Promise.reject(connectionError) : Promise.resolve()),
    sync: jest.fn().mockResolvedValue(),
    query: jest.fn().mockResolvedValue([[]]),
  };
  const app = { set: jest.fn(), use: jest.fn(), get: jest.fn() };
  const server = { listen: jest.fn() };
  const socket = { init: jest.fn() };
  const logger = { info: jest.fn(), error: jest.fn() };
  const exit = jest.fn();
  const modules = {
    dotenv: { config: jest.fn() },
    http: { createServer: jest.fn(() => server) },
    express: Object.assign(() => app, { json: jest.fn(), urlencoded: jest.fn() }),
    cors: jest.fn(), helmet: jest.fn(), 'express-rate-limit': jest.fn(),
    './models': { sequelize }, './config/logger': logger, './socket': socket,
  };
  const file = process.env.APP_SOURCE_FILE || path.join(__dirname, '../app.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: name => {
      if (name.startsWith('./routes/')) return () => {};
      if (!(name in modules)) throw new Error(`Unexpected module: ${name}`);
      return modules[name];
    },
    process: { env: nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }, exit },
    module: { exports: {} },
  }, { filename: file });
  await new Promise(resolve => setImmediate(resolve));
  return { sequelize, server, socket, logger, exit };
}

describe('startup database tanpa DDL di luar development', () => {
  test.each(['production', undefined, 'test', 'staging'])('NODE_ENV=%s hanya autentikasi tanpa query/sync', async env => {
    const state = await runStartup(env);
    expect(state.sequelize.authenticate).toHaveBeenCalledTimes(1);
    expect(state.sequelize.query).not.toHaveBeenCalled();
    expect(state.sequelize.sync).not.toHaveBeenCalled();
    expect(state.server.listen).toHaveBeenCalledTimes(1);
    expect(state.socket.init).toHaveBeenCalledTimes(1);
    expect(state.exit).not.toHaveBeenCalled();
  });
  test('development tetap menjalankan cleanup dan sync sebelum listen', async () => {
    const state = await runStartup('development');
    expect(state.sequelize.query).toHaveBeenCalled();
    expect(state.sequelize.sync).toHaveBeenCalledWith({ alter: true });
    expect(state.sequelize.sync.mock.invocationCallOrder[0]).toBeLessThan(state.server.listen.mock.invocationCallOrder[0]);
    expect(state.server.listen).toHaveBeenCalledTimes(1);
  });
  test('koneksi gagal menghentikan startup tanpa listen atau perubahan database', async () => {
    const state = await runStartup('production', new Error('connection failed'));
    expect(state.exit).toHaveBeenCalledWith(1);
    expect(state.server.listen).not.toHaveBeenCalled();
    expect(state.sequelize.query).not.toHaveBeenCalled();
    expect(state.sequelize.sync).not.toHaveBeenCalled();
  });
});
