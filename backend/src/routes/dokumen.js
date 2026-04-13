const express = require('express');
const {
  SuratJalan, Invoice, SuratPengantar, SuratPengantarSub, ProformaInvoice,
  PenjualanOffline, PenjualanOfflineItem, Barang,
  Provinsi, Kabupaten, Kecamatan, Kelurahan,
  PenjualanInterior, PenjualanInteriorItem,
  SuratJalanInterior, SuratJalanInteriorItem,
  InvoiceInterior,
} = require('../models');

const includeAlamat = [
  { model: Provinsi, as: 'pengirimProvinsi' },
  { model: Kabupaten, as: 'pengirimKabupaten' },
  { model: Kecamatan, as: 'pengirimKecamatan' },
  { model: Kelurahan, as: 'pengirimKelurahan' },
];
const { authenticate } = require('../middleware/auth');
const {
  generatePDFSuratJalan,
  generatePDFInvoice,
  generatePDFSuratPengantar,
  generatePDFProforma,
} = require('../utils/pdfGenerator');
const { 
  generateHTMLSuratJalan, 
  generateHTMLSuratPengantar,
  generateHTMLInvoice
} = require('../utils/htmlGenerator');

const router = express.Router();

// Hapus CSP untuk semua dokumen print (template HTML butuh inline script + CDN)
router.use((_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options'); // agar gambar dari origin lain bisa dimuat
  next();
});

// GET /api/dokumen/surat-jalan/:id/print
router.get('/surat-jalan/:id/print', authenticate, async (req, res) => {
  try {
    const sj = await SuratJalan.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          ...includeAlamat,
        ],
      }],
    });
    if (!sj) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    
    const html = generateHTMLSuratJalan(sj.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/invoice/:id/print
router.get('/invoice/:id/print', authenticate, async (req, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          { model: SuratJalan, as: 'suratJalans' },
          ...includeAlamat,
        ],
      }],
    });
    if (!inv) return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    
    const html = generateHTMLInvoice(inv.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/sp/:id/print
router.get('/sp/:id/print', authenticate, async (req, res) => {
  try {
    const sp = await SuratPengantar.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          ...includeAlamat,
        ],
      }],
    });
    if (!sp) return res.status(404).json({ message: 'Surat Pengantar tidak ditemukan' });
    
    const html = generateHTMLSuratPengantar(sp.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/sp-sub/:id/print
router.get('/sp-sub/:id/print', authenticate, async (req, res) => {
  try {
    const sub = await SuratPengantarSub.findByPk(req.params.id, {
      include: [
        {
          model: SuratPengantar, as: 'suratPengantar',
          include: [{
            model: PenjualanOffline, as: 'penjualan',
            include: [...includeAlamat],
          }],
        },
        { model: PenjualanOfflineItem, as: 'item', include: [{ model: Barang, as: 'barang' }] },
      ],
    });
    if (!sub) return res.status(404).json({ message: 'Sub-SP tidak ditemukan' });

    const data = sub.toJSON();
    // Pakai template SP utama tapi override nomor_sp dan items (hanya 1 item ini)
    const spData = {
      ...data.suratPengantar,
      nomor_sp: data.nomor_sp_sub,
      penjualan: {
        ...data.suratPengantar.penjualan,
        items: [data.item],
      },
    };

    const html = generateHTMLSuratPengantar(spData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/proforma/:id/print
router.get('/proforma/:id/print', authenticate, async (req, res) => {
  try {
    const proforma = await ProformaInvoice.findByPk(req.params.id, {
      include: [{
        model: PenjualanInterior, as: 'penjualan',
        include: [{ model: PenjualanInteriorItem, as: 'items' }],
      }],
    });
    if (!proforma) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    generatePDFProforma(res, proforma.toJSON());
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/surat-jalan-interior/:id/print
router.get('/surat-jalan-interior/:id/print', authenticate, async (req, res) => {
  try {
    const sji = await SuratJalanInterior.findByPk(req.params.id, {
      include: [
        { model: PenjualanInterior, as: 'penjualan' },
        {
          model: SuratJalanInteriorItem, as: 'items',
          include: [{ model: PenjualanInteriorItem, as: 'item' }],
        },
      ],
    });
    if (!sji) return res.status(404).json({ message: 'Surat Jalan Interior tidak ditemukan' });

    const data = sji.toJSON();

    // Normalize data structure agar bisa dipakai oleh generatePDFSuratJalan
    const normalized = {
      nomor_surat: data.nomor_surat,
      tanggal: data.tanggal,
      catatan: data.catatan,
      penjualan: {
        nama_penerima: data.penjualan.nama_customer,
        pengirim_detail: data.penjualan.nama_pt_npwp,
        faktur: data.penjualan.faktur,
        items: (data.items || []).map(i => ({
          barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang },
          qty: i.qty_kirim,
          barang_id: i.penjualan_interior_item_id,
        })),
      },
    };

    const html = generateHTMLSuratJalan(normalized);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/invoice-interior/:id/print
router.get('/invoice-interior/:id/print', authenticate, async (req, res) => {
  try {
    const inv = await InvoiceInterior.findByPk(req.params.id, {
      include: [
        { model: PenjualanInterior, as: 'penjualan' },
        {
          model: SuratJalanInterior, as: 'suratJalan',
          include: [{
            model: SuratJalanInteriorItem, as: 'items',
            include: [{ model: PenjualanInteriorItem, as: 'item' }],
          }],
        },
      ],
    });
    if (!inv) return res.status(404).json({ message: 'Invoice Interior tidak ditemukan' });

    const data = inv.toJSON();

    // Normalize: pakai item dari surat jalan terkait (qty_kirim), harga dari PenjualanInteriorItem
    const invoiceItems = (data.suratJalan?.items || []).map(i => ({
      barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang },
      qty: i.qty_kirim,
      harga_satuan: parseFloat(i.item?.harga_satuan || 0),
      subtotal: parseFloat(i.item?.harga_satuan || 0) * i.qty_kirim,
    }));

    const normalized = {
      nomor_invoice: data.nomor_invoice,
      tanggal: data.tanggal,
      catatan: data.catatan,
      penjualan: {
        nama_penerima: data.penjualan.nama_customer,
        pengirim_detail: data.penjualan.nama_pt_npwp,
        no_po: data.penjualan.no_po,
        no_npwp: data.penjualan.no_npwp,
        faktur: data.penjualan.faktur,
        suratJalans: data.suratJalan ? [{ nomor_surat: data.suratJalan.nomor_surat }] : [],
        items: invoiceItems,
      },
    };

    const html = generateHTMLInvoice(normalized);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
