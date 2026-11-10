const { selectLatestBySale } = require('./financialDocuments');
const money = value => Math.round(Number(value || 0));

function buildOnlineJournal(invoices = [], payments = [], returs = [], line) {
  const groups = new Map();
  const add = (row, type) => {
    const sale = row.penjualan;
    if (!sale || (type === 'INVOICE' && sale.status === 'DIBATALKAN')) return;
    const id = Number(row.penjualan_online_id || sale.id);
    if (!groups.has(id)) groups.set(id, { sale, events: [] });
    groups.get(id).events.push({ type, row });
  };
  selectLatestBySale(invoices, 'penjualan_online_id').forEach(row => add(row, 'INVOICE'));
  payments.forEach(row => add(row, 'PAYMENT'));
  returs.filter(row => row.tipe === 'PENGEMBALIAN_DANA').forEach(row => add(row, 'REFUND'));
  const result = [];
  for (const [saleId, { sale, events }] of groups) {
    let advance = 0, outstanding = 0, billed = false, deferredReturn = 0;
    const priority = { INVOICE: 0, PAYMENT: 1, REFUND: 2 };
    events.sort((a, b) => String(a.row.tanggal).localeCompare(String(b.row.tanggal)) || priority[a.type] - priority[b.type] || Number(a.row.id) - Number(b.row.id));
    const entry = (row, jenis, amount, lines, keterangan, suffix = '') => {
      if (amount <= 0) return;
      result.push({
        id: `ONLINE-${jenis}-${row.id}${suffix}`, tanggal: row.tanggal, sumber: 'ONLINE', jenis,
        referensi: row.nomor_invoice || sale.id_pesanan, customer: sale.nama_pelanggan,
        nilai: amount, keterangan, detail_url: `/dashboard/penjualan/online/${saleId}`, lines,
      });
    };
    for (const { type, row } of events) {
      if (type === 'INVOICE') {
        const items = (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
        const total = Math.max(0, money(items + Number(sale.ongkir || 0) + Number(sale.biaya_lain || 0) - Number(sale.diskon_order || 0)));
        entry(row, 'INVOICE', total, [line('1201', total), line('4103', 0, total)], 'Invoice penjualan online');
        // Refunds made before billing first reverse the unearned advance.
        // Recognize that part as a sales return when the invoice is issued.
        const adjustment = Math.min(deferredReturn, total);
        entry(row, 'PENYESUAIAN_RETUR', adjustment, [line('4203', adjustment), line('1201', 0, adjustment)], 'Pengakuan retur dana sebelum invoice');
        deferredReturn -= adjustment;
        const used = Math.min(advance, total - adjustment);
        advance -= used;
        outstanding += total - adjustment - used;
        billed = true;
        entry(row, 'UANG_MUKA_TERPAKAI', used, [line('2102', used), line('1201', 0, used)], 'Pembayaran online sebelumnya dipakai untuk invoice');
      } else if (type === 'PAYMENT') {
        const amount = Math.max(0, money(row.jumlah));
        const normal = Math.min(outstanding, amount);
        const incoming = amount - normal;
        outstanding -= normal;
        advance += incoming;
        entry(row, 'PEMBAYARAN', amount, [line('1106', amount), ...(normal > 0 ? [line('1201', 0, normal)] : []), ...(incoming > 0 ? [line('2102', 0, incoming)] : [])], 'Pembayaran customer ke marketplace/gateway; bukan pencairan bank');
      } else {
        const amount = Math.max(0, money(row.jumlah_refund));
        const reversedAdvance = billed ? 0 : Math.min(advance, amount);
        advance -= reversedAdvance;
        deferredReturn += reversedAdvance;
        entry(row, 'RETUR', amount, [...(reversedAdvance > 0 ? [line('2102', reversedAdvance)] : []), ...(amount > reversedAdvance ? [line('4203', amount - reversedAdvance)] : []), line('1106', 0, amount)], 'Pengembalian dana customer melalui marketplace/gateway');
      }
    }
  }
  return result;
}
module.exports = { buildOnlineJournal };
