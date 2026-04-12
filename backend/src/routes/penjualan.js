const express = require('express');
const { sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const { QueryTypes } = require('sequelize');

const router = express.Router();

router.get('/semua', authenticate, async (req, res) => {
  try {
    const {
      search, sumber, status, faktur,
      tanggal_dari, tanggal_sampai,
      page = '1', limit = '20',
    } = req.query;

    if (sumber && sumber !== 'OFFLINE' && sumber !== 'INTERIOR') {
      return res.status(400).json({ message: 'Parameter sumber tidak valid. Gunakan OFFLINE atau INTERIOR.' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Isolasi data test vs produksi
    const isTest = req.user.role === 'TEST' ? 1 : 0;

    // Build WHERE clauses for each branch
    const offlineWhere = ['tipe = ?', 'is_test = ?'];
    const offlineReplacements = ['PENJUALAN', isTest];

    const interiorWhere = ['is_test = ?'];
    const interiorReplacements = [isTest];

    if (search) {
      const likeVal = `%${search}%`;
      offlineWhere.push('(nama_penerima LIKE ? OR no_po LIKE ?)');
      offlineReplacements.push(likeVal, likeVal);

      interiorWhere.push('(nama_customer LIKE ? OR no_po LIKE ?)');
      interiorReplacements.push(likeVal, likeVal);
    }

    if (status) {
      offlineWhere.push('status = ?');
      offlineReplacements.push(status);

      interiorWhere.push('status = ?');
      interiorReplacements.push(status);
    }

    if (faktur) {
      offlineWhere.push('faktur = ?');
      offlineReplacements.push(faktur);

      interiorWhere.push('faktur = ?');
      interiorReplacements.push(faktur);
    }

    if (tanggal_dari) {
      offlineWhere.push('tanggal >= ?');
      offlineReplacements.push(tanggal_dari);

      interiorWhere.push('tanggal >= ?');
      interiorReplacements.push(tanggal_dari);
    }

    if (tanggal_sampai) {
      offlineWhere.push('tanggal <= ?');
      offlineReplacements.push(tanggal_sampai);

      interiorWhere.push('tanggal <= ?');
      interiorReplacements.push(tanggal_sampai);
    }

    const offlineWhereClause = offlineWhere.length > 0 ? `WHERE ${offlineWhere.join(' AND ')}` : '';
    const interiorWhereClause = interiorWhere.length > 0 ? `WHERE ${interiorWhere.join(' AND ')}` : '';

    // Determine which branches to include based on sumber filter
    const includeOffline = !sumber || sumber === 'OFFLINE';
    const includeInterior = !sumber || sumber === 'INTERIOR';

    // Build UNION ALL parts for main query
    const unionParts = [];
    const mainReplacements = [];

    if (includeOffline) {
      unionParts.push(`
        SELECT id, 'OFFLINE' AS sumber, tanggal, nama_penerima AS nama_customer,
               no_po, faktur, status, created_at,
               (SELECT COUNT(*) FROM penjualan_offline_items WHERE penjualan_offline_id = po.id) AS jumlah_item
        FROM penjualan_offline po
        ${offlineWhereClause}
      `);
      mainReplacements.push(...offlineReplacements);
    }

    if (includeInterior) {
      unionParts.push(`
        SELECT id, 'INTERIOR' AS sumber, tanggal, nama_customer,
               no_po, faktur, status, created_at,
               (SELECT COUNT(*) FROM penjualan_interior_items WHERE penjualan_interior_id = pi.id) AS jumlah_item
        FROM penjualan_interior pi
        ${interiorWhereClause}
      `);
      mainReplacements.push(...interiorReplacements);
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

    const countUnionSQL = countParts.join(' UNION ALL ');
    const countSQL = `SELECT COUNT(*) AS total FROM (${countUnionSQL}) AS combined`;

    // Execute both queries
    const [rows, countResult] = await Promise.all([
      sequelize.query(mainSQL, { replacements: mainReplacements, type: QueryTypes.SELECT }),
      sequelize.query(countSQL, { replacements: countReplacements, type: QueryTypes.SELECT }),
    ]);

    const total = parseInt(countResult[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      data: rows,
      total,
      page: pageNum,
      totalPages,
    });

  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
