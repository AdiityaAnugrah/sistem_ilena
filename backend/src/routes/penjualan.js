const express = require('express');
const { sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const { QueryTypes } = require('sequelize');

const { createInvoiceBasis, invoiceProjects } = require('../utils/invoiceBasis');
const invoiceBasis = createInvoiceBasis(require('../models'));
const { financeDateRangeError } = require('../utils/financeDateRange');
const router = express.Router();
const TXT_COLLATION = 'utf8mb4_unicode_ci';
const txt = (expr) => `CONVERT(${expr} USING utf8mb4) COLLATE ${TXT_COLLATION}`;

router.get('/semua', authenticate, async (req, res) => {
  try {
    const {
      search, sumber, status, faktur,
      tanggal_dari, tanggal_sampai,
      page = '1', limit = '20',
    } = req.query;

    const dateError = financeDateRangeError({ from: tanggal_dari, to: tanggal_sampai });
    if (dateError) return res.status(400).json({ message: dateError });
    if (sumber && !['OFFLINE', 'ONLINE', 'INTERIOR'].includes(String(sumber))) {
      return res.status(400).json({ message: 'Parameter sumber tidak valid. Gunakan OFFLINE, ONLINE, atau INTERIOR.' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Isolasi data test vs produksi
    const isTest = req.user.role === 'TEST' ? 1 : 0;

    // Build WHERE clauses for each branch
    const offlineWhere = ['is_test = ?'];
    const offlineReplacements = [isTest];

    const interiorWhere = ['is_test = ?'];
    const interiorReplacements = [isTest];

    const onlineWhere = ['is_test = ?'];
    const onlineReplacements = [isTest];

    if (search) {
      const likeVal = `%${search}%`;
      offlineWhere.push('(nama_penerima LIKE ? OR no_po LIKE ?)');
      offlineReplacements.push(likeVal, likeVal);

      interiorWhere.push('(nama_customer LIKE ? OR no_po LIKE ?)');
      interiorReplacements.push(likeVal, likeVal);

      onlineWhere.push('(nama_pelanggan LIKE ? OR id_pesanan LIKE ? OR no_hp LIKE ?)');
      onlineReplacements.push(likeVal, likeVal, likeVal);
    }

    if (status) {
      offlineWhere.push('status = ?');
      offlineReplacements.push(status);

      interiorWhere.push('status = ?');
      interiorReplacements.push(status);

      if (status === 'COMPLETED') {
        onlineWhere.push('status = ?');
        onlineReplacements.push('SELESAI');
      } else if (status === 'ACTIVE') {
        onlineWhere.push("status IN ('DIPROSES', 'DIKIRIM', 'RETUR')");
      } else if (status === 'DRAFT') {
        onlineWhere.push('1 = 0');
      } else {
        onlineWhere.push('status = ?');
        onlineReplacements.push(status);
      }
    }

    if (faktur) {
      offlineWhere.push('faktur = ?');
      offlineReplacements.push(faktur);

      interiorWhere.push('faktur = ?');
      interiorReplacements.push(faktur);

      onlineWhere.push('faktur = ?');
      onlineReplacements.push(faktur);
    }

    const invoiceData = await invoiceBasis.load({ source: sumber || '', isTest, to: tanggal_sampai, scope: { faktur } });
    const invoiceRows = invoiceProjects(invoiceData, { from: tanggal_dari, to: tanggal_sampai }).filter(row => {
      const sale = row.sale || {};
      if (status && (row.sumber === 'ONLINE' ? (status === 'COMPLETED' ? sale.status !== 'SELESAI' : status === 'ACTIVE' ? !['DIPROSES', 'DIKIRIM', 'RETUR'].includes(sale.status) : true) : sale.status !== status)) return false;
      if (search && ![sale.nama_customer, sale.nama_penerima, sale.nama_pelanggan, sale.no_po, sale.id_pesanan, sale.no_hp].filter(Boolean).join(' ').toLowerCase().includes(String(search).toLowerCase())) return false;
      return true;
    });
    const totalInvoiceNet = invoiceRows.reduce((sum, row) => sum + row.net, 0);

    // Restrict the registry to projects represented by invoice/credit events in
    // the selected invoice period; an unbilled draft remains in its source module.
    for (const [source, clauses, replacements] of [
      ['OFFLINE', offlineWhere, offlineReplacements], ['INTERIOR', interiorWhere, interiorReplacements], ['ONLINE', onlineWhere, onlineReplacements],
    ]) {
      const ids = invoiceRows.filter(row => row.sumber === source).map(row => row.id);
      clauses.push('id IN (?)'); replacements.push(ids.length ? ids : [0]);
    }

    const offlineWhereClause = offlineWhere.length > 0 ? `WHERE ${offlineWhere.join(' AND ')}` : '';
    const interiorWhereClause = interiorWhere.length > 0 ? `WHERE ${interiorWhere.join(' AND ')}` : '';
    const onlineWhereClause = onlineWhere.length > 0 ? `WHERE ${onlineWhere.join(' AND ')}` : '';

    // Determine which branches to include based on sumber filter
    const includeOffline = !sumber || sumber === 'OFFLINE';
    const includeOnline = !sumber || sumber === 'ONLINE';
    const includeInterior = !sumber || sumber === 'INTERIOR';

    // Build UNION ALL parts for main query
    const unionParts = [];
    const mainReplacements = [];

    if (includeOffline) {
      unionParts.push(`
        SELECT id,
               ${txt("'OFFLINE'")} AS sumber,
               tanggal,
               ${txt('nama_penerima')} AS nama_customer,
               ${txt('COALESCE(no_po, "")')} AS no_po,
               ${txt('faktur')} AS faktur,
               ${txt('status')} AS status,
               created_at,
               (SELECT COUNT(*) FROM penjualan_offline_items WHERE penjualan_offline_id = po.id) AS jumlah_item
        FROM penjualan_offline po
        ${offlineWhereClause}
      `);
      mainReplacements.push(...offlineReplacements);
    }

    if (includeInterior) {
      unionParts.push(`
        SELECT id,
               ${txt("'INTERIOR'")} AS sumber,
               tanggal,
               ${txt('nama_customer')} AS nama_customer,
               ${txt('COALESCE(no_po, "")')} AS no_po,
               ${txt('faktur')} AS faktur,
               ${txt('status')} AS status,
               created_at,
               (SELECT COUNT(*) FROM penjualan_interior_items WHERE penjualan_interior_id = pi.id) AS jumlah_item
        FROM penjualan_interior pi
        ${interiorWhereClause}
      `);
      mainReplacements.push(...interiorReplacements);
    }

    if (includeOnline) {
      unionParts.push(`
        SELECT id,
               ${txt("'ONLINE'")} AS sumber,
               tanggal,
               ${txt('nama_pelanggan')} AS nama_customer,
               ${txt('id_pesanan')} AS no_po,
               ${txt('faktur')} AS faktur,
               ${txt("CASE WHEN status = 'SELESAI' THEN 'COMPLETED' ELSE 'ACTIVE' END")} AS status,
               created_at,
               (SELECT COUNT(*) FROM penjualan_online_items WHERE penjualan_online_id = po2.id) AS jumlah_item
        FROM penjualan_online po2
        ${onlineWhereClause}
      `);
      mainReplacements.push(...onlineReplacements);
    }

    const unionSQL = unionParts.join(' UNION ALL ');
    const mainSQL = `${unionSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    mainReplacements.push(limitNum, offset);

    // Build COUNT query parts
    const countParts = [];
    const countReplacements = [];

    if (includeOffline) {
      countParts.push(`
        SELECT id FROM penjualan_offline
        ${offlineWhereClause}
      `);
      countReplacements.push(...offlineReplacements);
    }

    if (includeInterior) {
      countParts.push(`
        SELECT id FROM penjualan_interior
        ${interiorWhereClause}
      `);
      countReplacements.push(...interiorReplacements);
    }

    if (includeOnline) {
      countParts.push(`
        SELECT id FROM penjualan_online
        ${onlineWhereClause}
      `);
      countReplacements.push(...onlineReplacements);
    }

    const countUnionSQL = countParts.join(' UNION ALL ');
    const countSQL = `SELECT COUNT(*) AS total FROM (${countUnionSQL}) AS combined`;

    const [rows, countResult] = await Promise.all([
      sequelize.query(mainSQL, { replacements: mainReplacements, type: QueryTypes.SELECT }),
      sequelize.query(countSQL, { replacements: countReplacements, type: QueryTypes.SELECT }),
    ]);

    const total = parseInt(countResult[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      data: rows.map(row => ({ ...row, tanggal: invoiceRows.find(invoice => invoice.sumber === row.sumber && invoice.id === row.id)?.tanggal || row.tanggal })),
      total,
      page: pageNum,
      totalPages,
      summary: {
        totalNilai: Math.round(totalInvoiceNet),
      },
    });

  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
