const express = require('express');
const {
  SuratJalan, Invoice, SuratPengantar, SuratPengantarSub, ProformaInvoice,
  PenjualanOffline, PenjualanOfflineItem, Barang,
  Provinsi, Kabupaten, Kecamatan, Kelurahan,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, ReturSJInterior,
  InvoiceInterior, SuratPengantarInterior, SuratPengantarInteriorItem,
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
  generateHTMLSuratPengantarInterior,
  generateHTMLInvoice,
  generateHTMLProforma,
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

    const data = sp.toJSON();

    // Untuk DISPLAY: rekonstruksi qty asli = qty sisa + qty yang sudah terjual
    if (data.penjualan?.tipe === 'DISPLAY') {
      const lakuPenjualans = await PenjualanOffline.findAll({
        where: { display_source_id: data.penjualan.id },
        include: [{ model: PenjualanOfflineItem, as: 'items' }],
      });
      // Map: "barang_id-varian_id" -> total qty terjual
      const soldMap = {};
      for (const laku of lakuPenjualans) {
        for (const item of (laku.items || [])) {
          const key = `${item.barang_id}-${item.varian_id || ''}`;
          soldMap[key] = (soldMap[key] || 0) + item.qty;
        }
      }
      // Restore qty asli pada setiap item display
      data.penjualan.items = (data.penjualan.items || []).map(item => {
        const key = `${item.barang_id}-${item.varian_id || ''}`;
        return { ...item, qty: item.qty + (soldMap[key] || 0) };
      });
    }

    const html = generateHTMLSuratPengantar(data);
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
        include: [
          { model: PenjualanInteriorItem, as: 'items' },
          { model: PembayaranInterior, as: 'pembayarans' },
        ],
      }],
    });
    if (!proforma) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    const html = generateHTMLProforma(proforma.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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
      include: [{ model: PenjualanInterior, as: 'penjualan' }],
    });
    if (!inv) return res.status(404).json({ message: 'Invoice Interior tidak ditemukan' });

    const data = inv.toJSON();

    // Resolve SJ IDs: prefer surat_jalan_ids array, fall back to single surat_jalan_interior_id
    let sjIds = [];
    if (data.surat_jalan_ids) {
      try { sjIds = JSON.parse(data.surat_jalan_ids); } catch { sjIds = []; }
    } else if (data.surat_jalan_interior_id) {
      sjIds = [data.surat_jalan_interior_id];
    }

    // Load all referenced SJs with retur
    const suratJalans = await SuratJalanInterior.findAll({
      where: { id: sjIds },
      include: [
        {
          model: SuratJalanInteriorItem, as: 'items',
          include: [{ model: PenjualanInteriorItem, as: 'item' }],
        },
        { model: ReturSJInterior, as: 'returs' },
      ],
    });

    // Build retur map: penjualan_interior_item_id -> total qty retur
    const returMap = {};
    for (const sj of suratJalans) {
      for (const r of (sj.returs || [])) {
        const k = r.penjualan_interior_item_id;
        returMap[k] = (returMap[k] || 0) + r.qty_retur;
      }
    }

    // PPN dari penjualan interior
    const ppnPersen = data.penjualan.pakai_ppn && data.penjualan.ppn_persen
      ? parseInt(data.penjualan.ppn_persen) : 0;

    // Merge items from all SJs, kurangi retur, hitung subtotal inc PPN
    const invoiceItems = suratJalans.flatMap(sj =>
      (sj.items || []).map(i => {
        const returQty = returMap[i.penjualan_interior_item_id] || 0;
        const netQty = i.qty_kirim - returQty;
        if (netQty <= 0) return null;
        const hargaBase = parseFloat(i.item?.harga_satuan || 0);
        const hargaInc = ppnPersen > 0 ? Math.round(hargaBase * (1 + ppnPersen / 100)) : hargaBase;
        return {
          barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang },
          qty: netQty,
          harga_satuan: hargaInc,
          subtotal: hargaInc * netQty,
        };
      }).filter(Boolean)
    );

    const normalized = {
      nomor_invoice: data.nomor_invoice,
      tanggal: data.tanggal,
      jatuh_tempo: data.jatuh_tempo,
      catatan: data.catatan,
      ppn_persen: 0, // sudah embedded di harga_satuan
      penjualan: {
        nama_penerima: data.penjualan.nama_customer,
        pengirim_detail: data.penjualan.nama_pt_npwp,
        no_po: data.penjualan.no_po,
        no_npwp: data.penjualan.no_npwp,
        faktur: data.penjualan.faktur,
        suratJalans: suratJalans.map(sj => ({ nomor_surat: sj.nomor_surat })),
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

// GET /api/dokumen/sp-interior/:id/print
router.get('/sp-interior/:id/print', authenticate, async (req, res) => {
  try {
    const sp = await SuratPengantarInterior.findByPk(req.params.id, {
      include: [
        { model: PenjualanInterior, as: 'penjualan' },
        { model: SuratPengantarInteriorItem, as: 'items' },
      ],
    });
    if (!sp) return res.status(404).json({ message: 'Surat Pengantar Interior tidak ditemukan' });
    const html = generateHTMLSuratPengantarInterior(sp.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
