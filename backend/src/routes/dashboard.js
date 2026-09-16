const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline,
  PenjualanInterior,
  PenjualanOnline,
  PenjualanOfflineItem,
  PenjualanInteriorItem,
  PenjualanOnlineItem,
  PembayaranOnline,
  ReturOnline,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const money = (value) => Math.round(Number(value || 0));

function onlineTotal(row) {
  const data = row.toJSON ? row.toJSON() : row;
  const subtotal = (data.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const refund = (data.returs || []).reduce((sum, retur) => sum + Number(retur.jumlah_refund || 0), 0);
  return Math.max(0, money(subtotal + Number(data.ongkir || 0) + Number(data.biaya_lain || 0) - Number(data.diskon_order || 0) - refund));
}

router.get('/sales-followup', authenticate, async (req, res) => {
  try {
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const baseWhere = { is_test: isTest };
    const onlineWhere = { ...baseWhere, channel: 'WEBSITE' };
    const onlineWaitingWhere = {
      ...onlineWhere,
      catatan: { [Op.like]: '%MENUNGGU_PEMBAYARAN%' },
    };

    const [offlineActiveCount, interiorActiveCount, onlineWebsiteCount, onlineWaitingCount, offlineRows, interiorRows, onlineRows, onlineWaitingRows] = await Promise.all([
      PenjualanOffline.count({ where: { ...baseWhere, tipe: 'PENJUALAN', status: { [Op.ne]: 'COMPLETED' } } }),
      PenjualanInterior.count({ where: { ...baseWhere, status: { [Op.ne]: 'COMPLETED' } } }),
      PenjualanOnline.count({ where: onlineWhere }),
      PenjualanOnline.count({ where: onlineWaitingWhere }),
      PenjualanOffline.findAll({
        where: { ...baseWhere, tipe: 'PENJUALAN', status: { [Op.ne]: 'COMPLETED' } },
        attributes: ['id', 'nama_penerima', 'no_po', 'tanggal', 'status', 'created_at'],
        include: [{ model: PenjualanOfflineItem, as: 'items', attributes: ['subtotal'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      PenjualanInterior.findAll({
        where: { ...baseWhere, status: { [Op.ne]: 'COMPLETED' } },
        attributes: ['id', 'nama_customer', 'no_po', 'tanggal', 'status', 'pakai_ppn', 'ppn_persen', 'created_at'],
        include: [{ model: PenjualanInteriorItem, as: 'items', attributes: ['subtotal'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      PenjualanOnline.findAll({
        where: onlineWhere,
        attributes: ['id', 'id_pesanan', 'nama_pelanggan', 'tanggal', 'status', 'catatan', 'ongkir', 'biaya_lain', 'diskon_order', 'created_at'],
        include: [
          { model: PenjualanOnlineItem, as: 'items', attributes: ['subtotal'] },
          { model: PembayaranOnline, as: 'pembayarans', attributes: ['jumlah'] },
          { model: ReturOnline, as: 'returs', attributes: ['jumlah_refund'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      PenjualanOnline.findAll({
        where: onlineWaitingWhere,
        attributes: ['id', 'id_pesanan', 'nama_pelanggan', 'tanggal', 'status', 'catatan', 'ongkir', 'biaya_lain', 'diskon_order', 'created_at'],
        include: [
          { model: PenjualanOnlineItem, as: 'items', attributes: ['subtotal'] },
          { model: PembayaranOnline, as: 'pembayarans', attributes: ['jumlah'] },
          { model: ReturOnline, as: 'returs', attributes: ['jumlah_refund'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
    ]);

    const offline = offlineRows.map((row) => {
      const total = (row.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      return {
        id: row.id,
        title: row.nama_penerima,
        ref: row.no_po || `OFF-${row.id}`,
        tanggal: row.tanggal,
        status: row.status,
        total: money(total),
        href: `/dashboard/penjualan/offline/${row.id}`,
      };
    });

    const interior = interiorRows.map((row) => {
      const subtotal = (row.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const ppn = row.pakai_ppn ? subtotal * (parseInt(row.ppn_persen || 0, 10) / 100) : 0;
      return {
        id: row.id,
        title: row.nama_customer,
        ref: row.no_po || `INT-${row.id}`,
        tanggal: row.tanggal,
        status: row.status,
        total: money(subtotal + ppn),
        href: `/dashboard/penjualan/interior/${row.id}`,
      };
    });

    const mapOnline = (row) => ({
      id: row.id,
      title: row.nama_pelanggan,
      ref: row.id_pesanan,
      tanggal: row.tanggal,
      status: row.catatan?.includes('MENUNGGU_PEMBAYARAN') ? 'MENUNGGU_PEMBAYARAN' : row.status,
      total: onlineTotal(row),
      href: `/dashboard/penjualan/online/${row.id}`,
    });

    return res.json({
      summary: {
        offlineActive: offlineActiveCount,
        interiorActive: interiorActiveCount,
        onlineWebsite: onlineWebsiteCount,
        onlineWaitingPayment: onlineWaitingCount,
      },
      offline,
      interior,
      online: onlineRows.map(mapOnline),
      onlineWaitingPayment: onlineWaitingRows.map(mapOnline),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
