const express = require('express');
const {
  Invoice, InvoiceInterior,
  PenjualanOffline, PenjualanInterior,
  PenjualanOfflineItem, PenjualanInteriorItem,
  PembayaranInterior,
  SuratJalan, SuratPengantar, SuratPengantarSub,
  ProformaInvoice, SuratJalanInterior,
  SuratPengantarInterior,
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

// GET /api/public/surat/:sumber/:penjualanId — tree dokumen + ringkasan, tanpa auth
router.get('/:sumber/:penjualanId', async (req, res) => {
  try {
    const { sumber, penjualanId } = req.params;

    if (sumber === 'OFFLINE') {
      const penjualan = await PenjualanOffline.findByPk(penjualanId, {
        attributes: ['id', 'nama_penerima', 'no_hp_penerima', 'tipe', 'faktur', 'tanggal', 'status', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [items, invoices, suratJalans, suratPengantars] = await Promise.all([
        PenjualanOfflineItem.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['qty', 'harga_satuan', 'diskon', 'subtotal'],
        }),
        Invoice.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_invoice', 'tanggal', 'jatuh_tempo', 'ppn_persen'],
          order: [['tanggal', 'ASC']],
        }),
        SuratJalan.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_surat', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
        SuratPengantar.findAll({
          where: { penjualan_offline_id: penjualanId },
          attributes: ['id', 'nomor_sp', 'tanggal'],
          include: [{ model: SuratPengantarSub, as: 'subs', attributes: ['id', 'nomor_sp_sub'] }],
          order: [['tanggal', 'ASC']],
        }),
      ]);

      const subtotal = items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
      const ppnPersen = invoices[0]?.ppn_persen || 0;
      const ppn = subtotal * (ppnPersen / 100);
      const totalNilai = subtotal + ppn;
      const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'OFFLINE',
        ringkasan: {
          total_nilai: totalNilai,
          total_qty: totalQty,
          jumlah_sj: suratJalans.length,
          jatuh_tempo: invoices[0]?.jatuh_tempo || null,
        },
        dokumen: {
          invoices: invoices.map(d => ({ id: d.id, nomor: d.nomor_invoice, tanggal: d.tanggal, jatuh_tempo: d.jatuh_tempo, tipe: 'invoice' })),
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
        attributes: ['id', 'nama_customer', 'no_hp', 'tanggal', 'status', 'pakai_ppn', 'ppn_persen', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [items, proformas, suratJalans, invoices, pembayarans, suratPengantars] = await Promise.all([
        PenjualanInteriorItem.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['qty', 'harga_satuan', 'subtotal', 'sudah_kirim'],
        }),
        ProformaInvoice.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_proforma', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
        SuratJalanInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_surat', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
        InvoiceInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_invoice', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
        PembayaranInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'tipe', 'jumlah', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
        SuratPengantarInterior.findAll({
          where: { penjualan_interior_id: penjualanId },
          attributes: ['id', 'nomor_surat', 'tanggal'],
          order: [['tanggal', 'ASC']],
        }),
      ]);

      const subtotal = items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
      const ppn = penjualan.pakai_ppn ? subtotal * (parseInt(penjualan.ppn_persen) / 100) : 0;
      const grandTotal = subtotal + ppn;
      const totalBayar = pembayarans.reduce((s, p) => s + parseFloat(p.jumlah || 0), 0);
      const sisaTagihan = Math.max(0, grandTotal - totalBayar);
      const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
      const sudahKirim = items.reduce((s, i) => s + (i.sudah_kirim || 0), 0);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'INTERIOR',
        ringkasan: {
          grand_total: grandTotal,
          total_bayar: totalBayar,
          sisa_tagihan: sisaTagihan,
          persen_bayar: grandTotal > 0 ? Math.round((totalBayar / grandTotal) * 100) : 0,
          total_qty: totalQty,
          sudah_kirim: sudahKirim,
          persen_kirim: totalQty > 0 ? Math.round((sudahKirim / totalQty) * 100) : 0,
        },
        pembayarans: pembayarans.map(p => ({
          id: p.id, tipe: p.tipe, jumlah: parseFloat(p.jumlah), tanggal: p.tanggal,
        })),
        dokumen: {
          proformas: proformas.map(d => ({ id: d.id, nomor: d.nomor_proforma, tanggal: d.tanggal, tipe: 'proforma' })),
          suratJalans: suratJalans.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'surat-jalan-interior' })),
          suratPengantars: suratPengantars.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'sp-interior' })),
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
