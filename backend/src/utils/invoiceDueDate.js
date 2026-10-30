const DEFAULT_DUE_DAYS = 14;

function dateError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Calendar dates use UTC arithmetic so timezone/DST never shift the due date.
function resolveInvoiceDates({ tanggal, jatuh_tempo } = {}) {
  const documentDate = tanggal === undefined ? new Date().toISOString().slice(0, 10) : tanggal;
  if (!isIsoDate(documentDate)) throw dateError('Tanggal dokumen harus berupa tanggal valid YYYY-MM-DD');
  let dueDate = jatuh_tempo;
  if (dueDate === undefined) {
    const date = new Date(`${documentDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + DEFAULT_DUE_DAYS);
    dueDate = date.toISOString().slice(0, 10);
  }
  if (!isIsoDate(dueDate)) throw dateError('Jatuh tempo harus berupa tanggal valid YYYY-MM-DD');
  if (dueDate < documentDate) throw dateError('Jatuh tempo tidak boleh sebelum tanggal dokumen');
  return { tanggal: documentDate, jatuh_tempo: dueDate };
}

module.exports = { DEFAULT_DUE_DAYS, isIsoDate, resolveInvoiceDates };
