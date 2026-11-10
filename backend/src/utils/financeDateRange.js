function financeDateRangeError({ from, to } = {}) {
  for (const value of [from, to]) {
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Tanggal harus berformat YYYY-MM-DD';
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Tanggal tidak valid';
  }
  if (from && to && from > to) return 'Tanggal awal harus sebelum atau sama dengan tanggal akhir';
  return '';
}

module.exports = { financeDateRangeError };
