const path = require('path');

const columns = ['biaya_assembly', 'biaya_kirim'];
async function migrateInteriorCosts(db, apply = false) {
  const [before] = await db.query('SHOW COLUMNS FROM penjualan_interior');
  const existing = new Set(before.map(row => row.Field));
  const missing = columns.filter(column => !existing.has(column));
  if (apply && missing.length) {
    await db.query(`ALTER TABLE penjualan_interior ${missing.map(column => `ADD COLUMN ${column} DECIMAL(15,2) NULL DEFAULT NULL`).join(', ')}`);
  }
  const [after] = await db.query('SHOW COLUMNS FROM penjualan_interior');
  return { added: apply ? missing : [], ready: columns.every(column => after.some(row => row.Field === column)), columns: after.filter(row => columns.includes(row.Field)).map(row => ({ name: row.Field, type: row.Type, nullable: row.Null, default: row.Default })) };
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const host = process.env.DB_HOST;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.argv.includes('--deployment')) {
    throw new Error('Non-loopback migrations require the explicit --deployment flag');
  }
  const mysql = require('mysql2/promise');
  (async () => {
    const db = await mysql.createConnection({ host, port: process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try { console.log(JSON.stringify(await migrateInteriorCosts(db, process.argv.includes('--apply')))); }
    finally { await db.end(); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { migrateInteriorCosts };
