const express = require('express');
const { Op } = require('sequelize');
const {
  Invoice, InvoiceInterior,
  PenjualanOffline, PenjualanInterior,
  SuratJalan, SuratPengantar, SuratPengantarSub,
  ProformaInvoice, SuratJalanInterior,
} = require('../models');

const router = express.Router();

// GET /api/public/surat — list semua invoice (OFFLINE + INTERIOR), tanpa auth
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const [offlineRows, interiorRows] = await Promise.all([
      Invoice.findAll({
        include: [{ model: PenjualanOffline, as: 'penjualan', attributes: ['id', 'nama_penerima', 'is_test'] }],
        order: [['tanggal', 'DESC']],
      }),
      InvoiceInterior.findAll({
        include: [{ model: PenjualanInterior, as: 'penjualan', attributes: ['id', 'nama_customer', 'is_test'] }],
        order: [['tanggal', 'DESC']],
      }),
    ]);

    const combined = [
      ...offlineRows
        .filter(r => !r.penjualan?.is_test)
        .map(r => ({
          id: r.id,
          penjualan_id: r.penjualan_offline_id,
          nomor: r.nomor_invoice,
          tanggal: r.tanggal,
          jatuh_tempo: r.jatuh_tempo,
          nama_penerima: r.penjualan?.nama_penerima || '-',
          sumber: 'OFFLINE',
        })),
      ...interiorRows
        .filter(r => !r.penjualan?.is_test)
        .map(r => ({
          id: r.id,
          penjualan_id: r.penjualan_interior_id,
          nomor: r.nomor_invoice,
          tanggal: r.tanggal,
          jatuh_tempo: r.jatuh_tempo,
          nama_penerima: r.penjualan?.nama_customer || '-',
          sumber: 'INTERIOR',
        })),
    ]
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.nomor?.toLowerCase().includes(q) ||
          r.nama_penerima?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const total = combined.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const data = combined.slice(offset, offset + parseInt(limit));

    return res.json({
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)) || 1,
    });
  } catch (err) {
    console.error('[GET /api/public/surat]', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/public/surat/:sumber/:penjualanId — tree dokumen satu penjualan, tanpa auth
router.get('/:sumber/:penjualanId', async (req, res) => {
  try {
    const { sumber, penjualanId } = req.params;

    if (sumber === 'OFFLINE') {
      const penjualan = await PenjualanOffline.findByPk(penjualanId, {
        attributes: ['id', 'nama_penerima', 'tipe', 'faktur', 'tanggal', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [invoices, suratJalans, suratPengantars] = await Promise.all([
        Invoice.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_invoice', 'tanggal'],
        }),
        SuratJalan.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_surat', 'tanggal'],
        }),
        SuratPengantar.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_sp', 'tanggal'],
          include: [{ model: SuratPengantarSub, as: 'subs', attributes: ['id', 'nomor_sp_sub'] }],
        }),
      ]);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'OFFLINE',
        dokumen: {
          invoices: invoices.map(d => ({ id: d.id, nomor: d.nomor_invoice, tanggal: d.tanggal, tipe: 'invoice' })),
          suratJalans: suratJalans.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'surat-jalan' })),
          suratPengantars: suratPengantars.map(d => ({
            id: d.id, nomor: d.nomor_sp, tanggal: d.tanggal, tipe: 'sp',
            subs: (d.subs || []).map(s => ({ id: s.id, nomor: s.nomor_sp_sub, tipe: 'sp-sub' })),
          })),
        },
      });
    }

    if (sumber === 'INTERIOR') {
      const penjualan = await PenjualanInterior.findByPk(penjualanId, {
        attributes: ['id', 'nama_customer', 'tanggal', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [proformas, suratJalans, invoices] = await Promise.all([
        ProformaInvoice.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_proforma', 'tanggal'],
        }),
        SuratJalanInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_surat', 'tanggal'],
        }),
        InvoiceInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_invoice', 'tanggal'],
        }),
      ]);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'INTERIOR',
        dokumen: {
          proformas: proformas.map(d => ({ id: d.id, nomor: d.nomor_proforma, tanggal: d.tanggal, tipe: 'proforma' })),
          suratJalans: suratJalans.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'surat-jalan-interior' })),
          invoices: invoices.map(d => ({ id: d.id, nomor: d.nomor_invoice, tanggal: d.tanggal, tipe: 'invoice-interior' })),
        },
      });
    }

    return res.status(400).json({ message: 'Sumber tidak valid. Gunakan OFFLINE atau INTERIOR.' });
  } catch (err) {
    console.error('[GET /api/public/surat/:sumber/:id]', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
