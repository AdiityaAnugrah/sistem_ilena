async function migrateOnlineSettlements(db, apply = false) {
  if (apply) await db.query(`CREATE TABLE IF NOT EXISTS pencairan_online (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    penjualan_online_id INT NOT NULL,
    tanggal DATE NOT NULL,
    referensi VARCHAR(120) NOT NULL,
    jumlah_bruto DECIMAL(15,2) NOT NULL,
    biaya DECIMAL(15,2) NOT NULL,
    jumlah_bersih DECIMAL(15,2) NOT NULL,
    catatan TEXT NULL,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY pencairan_online_sale_reference (penjualan_online_id, referensi),
    KEY pencairan_online_date (tanggal)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [tables] = await db.query("SHOW TABLES LIKE 'pencairan_online'");
  if (!tables.length) return { ready: false, applyRequired: true, backfilled: 0 };
  const [columns] = await db.query('SHOW COLUMNS FROM pencairan_online');
  const names = new Set(columns.map(row => row.Field));
  for (const name of ['id', 'penjualan_online_id', 'tanggal', 'referensi', 'jumlah_bruto', 'biaya', 'jumlah_bersih', 'catatan', 'created_by', 'created_at']) {
    if (!names.has(name)) throw Error(`Schema pencairan_online tidak cocok: ${name}`);
  }
  const [indexes] = await db.query('SHOW INDEX FROM pencairan_online');
  const unique = indexes.filter(row => !Number(row.Non_unique) && row.Key_name !== 'PRIMARY');
  if (!unique.some(row => row.Column_name === 'referensi' && unique.some(other => other.Key_name === row.Key_name && other.Column_name === 'penjualan_online_id'))) throw Error('Unique reference index missing');
  return { ready: true, backfilled: 0 };
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
  const host = process.env.DB_HOST;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.argv.includes('--deployment')) throw Error('Non-loopback migrations require --deployment');
  (async () => {
    const db = await require('mysql2/promise').createConnection({ host, port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try {
      const result = await migrateOnlineSettlements(db, process.argv.includes('--apply'));
      console.log(JSON.stringify(result));
      if (!result.ready) process.exitCode = 1;
    } finally { await db.end(); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { migrateOnlineSettlements };
