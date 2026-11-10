function selectLatestBySale(rows = [], foreignKey, to) {
  const latest = new Map();
  for (const row of rows) {
    if (to && String(row.tanggal) > to) continue;
    const id = Number(row[foreignKey] || row.penjualan?.id);
    if (!id) continue;
    const previous = latest.get(id);
    if (!previous || String(row.tanggal) > String(previous.tanggal) || (String(row.tanggal) === String(previous.tanggal) && Number(row.id) > Number(previous.id))) latest.set(id, row);
  }
  return [...latest.values()];
}
module.exports = { selectLatestBySale };
