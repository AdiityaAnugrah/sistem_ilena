const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const {
  PenjualanOffline, PenjualanInterior,
  SuratJalan, Invoice, SuratPengantar,
  SuratJalanInterior, InvoiceInterior, ProformaInvoice, SuratPengantarInterior,
} = require('../models');

const router = express.Router();

const LIMIT = 5;

// GET /api/search?q=...
router.get('/', authenticate, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const like = { [Op.like]: `%${q}%` };

  try {
    const [
      offlinePenjualan,
      interiorPenjualan,
      sjOffline,
      invOffline,
      spOffline,
      sjInterior,
      invInterior,
      proforma,
      spInterior,
    ] = await Promise.all([
      PenjualanOffline.findAll({
        where: { nama_penerima: like, tipe: 'PENJUALAN' },
        attributes: ['id', 'nama_penerima', 'no_po', 'tanggal'],
        limit: LIMIT,
      }),
      PenjualanInterior.findAll({
        where: { [Op.or]: [{ nama_customer: like }, { no_po: like }, { nama_pt_npwp: like }] },
        attributes: ['id', 'nama_customer', 'no_po', 'tanggal'],
        limit: LIMIT,
      }),
      SuratJalan.findAll({
        where: { nomor_surat: like },
        attributes: ['id', 'nomor_surat', 'tanggal', 'penjualan_offline_id'],
        limit: LIMIT,
      }),
      Invoice.findAll({
        where: { nomor_invoice: like },
        attributes: ['id', 'nomor_invoice', 'tanggal', 'penjualan_offline_id'],
        limit: LIMIT,
      }),
      SuratPengantar.findAll({
        where: { nomor_sp: like },
        attributes: ['id', 'nomor_sp', 'tanggal', 'penjualan_offline_id'],
        limit: LIMIT,
      }),
      SuratJalanInterior.findAll({
        where: { nomor_surat: like },
        attributes: ['id', 'nomor_surat', 'tanggal', 'penjualan_interior_id'],
        limit: LIMIT,
      }),
      InvoiceInterior.findAll({
        where: { nomor_invoice: like },
        attributes: ['id', 'nomor_invoice', 'tanggal', 'penjualan_interior_id'],
        limit: LIMIT,
      }),
      ProformaInvoice.findAll({
        where: { [Op.or]: [{ nomor_proforma: like }, { nomor_sub_invoice: like }] },
        attributes: ['id', 'nomor_proforma', 'nomor_sub_invoice', 'tanggal', 'penjualan_interior_id'],
        limit: LIMIT,
      }),
      SuratPengantarInterior.findAll({
        where: { nomor_surat: like },
        attributes: ['id', 'nomor_surat', 'tanggal', 'penjualan_interior_id'],
        limit: LIMIT,
      }),
    ]);

    const results = [];

    offlinePenjualan.forEach(r => results.push({
      type: 'penjualan_offline',
      label: r.nama_penerima,
      sub: r.no_po ? `PO: ${r.no_po}` : r.tanggal,
      href: `/dashboard/penjualan/offline/${r.id}`,
      category: 'Penjualan Offline',
    }));

    interiorPenjualan.forEach(r => results.push({
      type: 'penjualan_interior',
      label: r.nama_customer,
      sub: r.no_po ? `PO: ${r.no_po}` : r.tanggal,
      href: `/dashboard/penjualan/interior/${r.id}`,
      category: 'Penjualan Interior',
    }));

    sjOffline.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_surat,
      sub: `Surat Jalan · ${r.tanggal}`,
      href: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
      category: 'Dokumen',
    }));

    invOffline.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_invoice,
      sub: `Invoice · ${r.tanggal}`,
      href: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
      category: 'Dokumen',
    }));

    spOffline.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_sp,
      sub: `Surat Pengantar · ${r.tanggal}`,
      href: `/dashboard/penjualan/offline/${r.penjualan_offline_id}`,
      category: 'Dokumen',
    }));

    sjInterior.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_surat,
      sub: `Surat Jalan Interior · ${r.tanggal}`,
      href: `/dashboard/penjualan/interior/${r.penjualan_interior_id}`,
      category: 'Dokumen',
    }));

    invInterior.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_invoice,
      sub: `Invoice Interior · ${r.tanggal}`,
      href: `/dashboard/penjualan/interior/${r.penjualan_interior_id}`,
      category: 'Dokumen',
    }));

    proforma.forEach(r => {
      const isSubInv = r.nomor_sub_invoice && r.nomor_sub_invoice.toLowerCase().includes(q.toLowerCase());
      results.push({
        type: 'dokumen',
        label: isSubInv ? r.nomor_sub_invoice : r.nomor_proforma,
        sub: `${isSubInv ? 'Invoice (Sub)' : 'Proforma Invoice'} · ${r.tanggal}`,
        href: `/dashboard/penjualan/interior/${r.penjualan_interior_id}`,
        category: 'Dokumen',
      });
    });

    spInterior.forEach(r => results.push({
      type: 'dokumen',
      label: r.nomor_surat,
      sub: `Surat Pengantar Interior · ${r.tanggal}`,
      href: `/dashboard/penjualan/interior/${r.penjualan_interior_id}`,
      category: 'Dokumen',
    }));

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
