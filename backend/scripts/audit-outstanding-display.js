/*
 * Audit Outstanding Display (READ-ONLY)
 *
 * Mengecek status display berdasarkan angka efektif:
 * - Sisa Display Beredar = item display saat ini setelah retur/mutasi
 * - Tagihan Display Belum Lunas = penjualan dari display yang belum terbayar
 * - Status efektif Selesai jika keduanya 0
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  PenjualanOffline, PenjualanOfflineItem, PembayaranOffline, SuratPengantar,
  ReturOffline,
} = require('../src/models');

const money = (v) => Math.round(Number(v || 0));
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName`,
    { replacements: { tableName } }
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function getReturQtyMap(itemIds) {
  const map = {};
  if (!itemIds.length || !(await tableExists('retur_offline'))) return map;
  const rows = await ReturOffline.findAll({
    where: { penjualan_offline_item_id: itemIds },
    attributes: ['penjualan_offline_item_id', 'qty_retur'],
  });
  for (const r of rows) {
    const id = Number(r.penjualan_offline_item_id);
    map[id] = (map[id] || 0) + Number(r.qty_retur || 0);
  }
  return map;
}

function itemNetSubtotal(item, returQty = 0) {
  const qty = Number(item.qty || 0);
  if (qty <= 0) return 0;
  const netQty = Math.max(0, qty - Number(returQty || 0));
  const unit = Number(item.subtotal || 0) / qty;
  return money(unit * netQty);
}

function sumItemsNet(items, returQtyMap) {
  return money((items || []).reduce((sum, item) => sum + itemNetSubtotal(item, returQtyMap[item.id] || 0), 0));
}

function sumPayments(payments) {
  return money((payments || []).reduce((sum, p) => sum + Number(p.jumlah || 0), 0));
}

function writeCsv(file, rows) {
  const columns = [
    ['id', 'Display ID'],
    ['nomor_sp', 'Nomor SP'],
    ['tanggal_sp', 'Tanggal SP'],
    ['nama_penerima', 'Customer'],
    ['status_asli', 'Status Asli'],
    ['status_efektif', 'Status Efektif'],
    ['nilai_sisa', 'Sisa Display Beredar'],
    ['nilai_terjual', 'Sudah Terjual'],
    ['tagihan_belum_lunas', 'Tagihan Display Belum Lunas'],
    ['alasan', 'Alasan'],
  ];
  const lines = [columns.map(([, label]) => csvEscape(label)).join(',')];
  for (const row of rows) lines.push(columns.map(([key]) => csvEscape(row[key])).join(','));
  fs.writeFileSync(file, lines.join('\n'));
}

(async () => {
  try {
    const [dbInfo] = await sequelize.query('SELECT DATABASE() AS db, @@hostname AS host');
    const hasPayments = await tableExists('pembayaran_offline');
    const hasMutasi = await tableExists('mutasi_display');

    const displays = await PenjualanOffline.findAll({
      where: { tipe: 'DISPLAY', is_test: 0 },
      include: [
        { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        { model: SuratPengantar, as: 'suratPengantars', attributes: ['id', 'nomor_sp', 'tanggal'], required: true },
      ],
      order: [[{ model: SuratPengantar, as: 'suratPengantars' }, 'tanggal', 'DESC'], ['created_at', 'DESC']],
    });

    const displayIds = displays.map(d => d.id);
    const sold = displayIds.length ? await PenjualanOffline.findAll({
      where: { tipe: 'PENJUALAN', is_test: 0, display_source_id: { [Op.in]: displayIds } },
      include: [
        { model: PenjualanOfflineItem, as: 'items', attributes: ['id', 'qty', 'subtotal'] },
        ...(hasPayments ? [{ model: PembayaranOffline, as: 'pembayarans', attributes: ['jumlah'] }] : []),
      ],
      attributes: ['id', 'display_source_id', 'status'],
    }) : [];

    const allItemIds = [
      ...displays.flatMap(d => (d.items || []).map(i => i.id)),
      ...sold.flatMap(s => (s.items || []).map(i => i.id)),
    ];
    const returQtyMap = await getReturQtyMap(allItemIds);

    const soldByDisplay = {};
    for (const p of sold) {
      const src = Number(p.display_source_id);
      const total = sumItemsNet(p.items || [], returQtyMap);
      const paid = sumPayments(p.pembayarans || []);
      soldByDisplay[src] ||= { total: 0, unpaid: 0 };
      soldByDisplay[src].total = money(soldByDisplay[src].total + total);
      soldByDisplay[src].unpaid = money(soldByDisplay[src].unpaid + Math.max(0, total - paid));
    }

    const rows = displays.map(d => {
      const nilaiSisa = d.status === 'COMPLETED' ? 0 : sumItemsNet(d.items || [], returQtyMap);
      const nilaiTerjual = soldByDisplay[d.id]?.total || 0;
      const tagihanBelumLunas = soldByDisplay[d.id]?.unpaid || 0;
      const statusEfektif = nilaiSisa <= 0 && tagihanBelumLunas <= 0 ? 'COMPLETED' : 'ACTIVE';
      return {
        id: d.id,
        nomor_sp: d.suratPengantars?.[0]?.nomor_sp || '',
        tanggal_sp: d.suratPengantars?.[0]?.tanggal || '',
        nama_penerima: d.nama_penerima,
        status_asli: d.status,
        status_efektif: statusEfektif,
        nilai_sisa: money(nilaiSisa),
        nilai_terjual: money(nilaiTerjual),
        tagihan_belum_lunas: money(tagihanBelumLunas),
        alasan: statusEfektif === 'COMPLETED'
          ? 'Tidak ada sisa display dan tidak ada tagihan belum lunas'
          : nilaiSisa > 0 ? 'Masih ada sisa display beredar' : 'Display habis tetapi tagihan belum lunas',
      };
    });

    const docsDir = path.resolve(__dirname, '../../docs');
    fs.mkdirSync(docsDir, { recursive: true });
    const jsonPath = path.join(docsDir, 'audit-outstanding-display.json');
    const csvPath = path.join(docsDir, 'audit-outstanding-display.csv');
    const summary = {
      generated_at: new Date().toISOString(),
      db: dbInfo[0],
      total_display_ber_sp: rows.length,
      status_mismatch: rows.filter(r => r.status_asli !== r.status_efektif).length,
      selesai_efektif: rows.filter(r => r.status_efektif === 'COMPLETED').length,
      berjalan_efektif: rows.filter(r => r.status_efektif !== 'COMPLETED').length,
      total_sisa_display: money(rows.reduce((s, r) => s + r.nilai_sisa, 0)),
      total_tagihan_belum_lunas: money(rows.reduce((s, r) => s + r.tagihan_belum_lunas, 0)),
      mutasi_display_table_exists: hasMutasi,
    };
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, rows }, null, 2));
    writeCsv(csvPath, rows);
    console.log(JSON.stringify({ ok: true, summary, files: { jsonPath, csvPath } }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
