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

const { createInvoiceBasis, invoiceProjects } = require('../utils/invoiceBasis');
const invoiceBasis = createInvoiceBasis(require('../models'));

const router = express.Router();
const money = (value) => Math.round(Number(value || 0));

router.get('/sales-followup', authenticate, async (req, res) => {
  try {
    const isTest = req.user.role === 'TEST' ? 1 : 0;
    const financials = invoiceProjects(await invoiceBasis.load({ isTest }));
    const net = (source, id) => financials.find(row => row.sumber === source && row.id === Number(id))?.net || 0;
    const baseWhere = { is_test: isTest };
    const onlineWhere = { ...baseWhere, channel: 'WEBSITE' };
    const onlineActiveWhere = {
      ...onlineWhere,
      status: { [Op.in]: ['DIPROSES', 'DIKIRIM'] },
    };
    const onlineWaitingWhere = {
      ...onlineActiveWhere,
      catatan: { [Op.like]: '%MENUNGGU_PEMBAYARAN%' },
    };

    const [offlineActiveCount, interiorActiveCount, onlineWebsiteCount, onlineWebsiteTodoCount, onlineWaitingCount, offlineRows, interiorRows, onlineRows, onlineWaitingRows] = await Promise.all([
      PenjualanOffline.count({ where: { ...baseWhere, tipe: 'PENJUALAN', status: { [Op.ne]: 'COMPLETED' } } }),
      PenjualanInterior.count({ where: { ...baseWhere, status: { [Op.ne]: 'COMPLETED' } } }),
      PenjualanOnline.count({ where: onlineWhere }),
      PenjualanOnline.count({ where: onlineActiveWhere }),
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
        attributes: ['id', 'nama_customer', 'no_po', 'tanggal', 'status', 'pakai_ppn', 'ppn_persen', 'biaya_assembly', 'biaya_kirim', 'created_at'],
        include: [{ model: PenjualanInteriorItem, as: 'items', attributes: ['qty', 'harga_satuan', 'subtotal'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      PenjualanOnline.findAll({
        where: onlineActiveWhere,
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
      const total = net('OFFLINE', row.id);
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

      return {
        id: row.id,
        title: row.nama_customer,
        ref: row.no_po || `INT-${row.id}`,
        tanggal: row.tanggal,
        status: row.status,
        total: net('INTERIOR', row.id),
        href: `/dashboard/penjualan/interior/${row.id}`,
      };
    });

    const mapOnline = (row) => ({
      id: row.id,
      title: row.nama_pelanggan,
      ref: row.id_pesanan,
      tanggal: row.tanggal,
      status: row.catatan?.includes('MENUNGGU_PEMBAYARAN') ? 'MENUNGGU_PEMBAYARAN' : row.status,
      total: net('ONLINE', row.id),
      href: `/dashboard/penjualan/online/${row.id}`,
    });

    return res.json({
      summary: {
        offlineActive: offlineActiveCount,
        interiorActive: interiorActiveCount,
        onlineWebsite: onlineWebsiteCount,
        onlineWebsiteTodo: onlineWebsiteTodoCount,
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
