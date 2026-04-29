const express = require('express');
const {
  SuratJalan, Invoice, SuratPengantar, SuratPengantarSub, ProformaInvoice,
  PenjualanOffline, PenjualanOfflineItem, ReturOffline, Barang,
  Provinsi, Kabupaten, Kecamatan, Kelurahan,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem,
  InvoiceInterior, SuratPengantarInterior, SuratPengantarInteriorItem,
} = require('../models');

// Kurangi qty item berdasarkan total retur; hapus item yang sudah diretur penuh
function applyReturs(items, returs) {
  const returMap = {};
  for (const r of (returs || [])) {
    returMap[r.penjualan_offline_item_id] = (returMap[r.penjualan_offline_item_id] || 0) + r.qty_retur;
  }
  return items
    .map(item => {
      const totalRetur = returMap[item.id] || 0;
      if (totalRetur === 0) return item;
      const netQty = item.qty - totalRetur;
      if (netQty <= 0) return null;
      const hargaSatuan = item.qty > 0 ? parseFloat(item.subtotal) / item.qty : 0;
      return { ...item, qty: netQty, subtotal: netQty * hargaSatuan };
    })
    .filter(Boolean);
}

const includeAlamat = [
  { model: Provinsi, as: 'pengirimProvinsi' },
  { model: Kabupaten, as: 'pengirimKabupaten' },
  { model: Kecamatan, as: 'pengirimKecamatan' },
  { model: Kelurahan, as: 'pengirimKelurahan' },
];
const { authenticate, authenticatePrint } = require('../middleware/auth');
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
  generateHTMLSubInvoice,
} = require('../utils/htmlGenerator');

const router = express.Router();

// Hapus CSP untuk semua dokumen print (template HTML butuh inline script + CDN)
router.use((_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options'); // agar gambar dari origin lain bisa dimuat
  next();
});

// GET /api/dokumen/surat-jalan/:id/print
router.get('/surat-jalan/:id/print', authenticatePrint, async (req, res) => {
  try {
    const sj = await SuratJalan.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          { model: ReturOffline, as: 'returs' },
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
router.get('/invoice/:id/print', authenticatePrint, async (req, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          { model: SuratJalan, as: 'suratJalans' },
          { model: ReturOffline, as: 'returs' },
          ...includeAlamat,
        ],
      }],
    });
    if (!inv) return res.status(404).json({ message: 'Invoice tidak ditemukan' });

    const data = inv.toJSON();
    if (data.penjualan) {
      data.penjualan.items = applyReturs(data.penjualan.items || [], data.penjualan.returs || []);
    }

    const html = generateHTMLInvoice(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/sp/:id/print
router.get('/sp/:id/print', authenticatePrint, async (req, res) => {
  try {
    const sp = await SuratPengantar.findByPk(req.params.id, {
      include: [{
        model: PenjualanOffline, as: 'penjualan',
        include: [
          { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
          { model: ReturOffline, as: 'returs' },
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
      const soldMap = {};
      for (const laku of lakuPenjualans) {
        for (const item of (laku.items || [])) {
          const key = `${item.barang_id}-${item.varian_id || ''}`;
          soldMap[key] = (soldMap[key] || 0) + item.qty;
        }
      }
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
router.get('/sp-sub/:id/print', authenticatePrint, async (req, res) => {
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
router.get('/proforma/:id/print', authenticatePrint, async (req, res) => {
  try {
    const proforma = await ProformaInvoice.findByPk(req.params.id, {
      include: [{
        model: PenjualanInterior, as: 'penjualan',
        include: [
          { model: PenjualanInteriorItem, as: 'items' },
          { model: PembayaranInterior, as: 'pembayarans' },
          { model: ProformaInvoice, as: 'proformas', attributes: ['id', 'terms', 'created_at'] },
          { model: Provinsi, as: 'alamatProvinsi' },
          { model: Kabupaten, as: 'alamatKabupaten' },
          { model: Kecamatan, as: 'alamatKecamatan' },
          { model: Kelurahan, as: 'alamatKelurahan' },
        ],
      }],
    });
    if (!proforma) return res.status(404).json({ message: 'Proforma tidak ditemukan' });

    const data = proforma.toJSON();

    // Hitung berapa term per tipe yang sudah "diklaim" proforma-proforma sebelum ini
    const allProformas = (data.penjualan.proformas || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const thisIdx = allProformas.findIndex(p => p.id === proforma.id);
    const priorTermsByTipe = {};
    allProformas.slice(0, thisIdx >= 0 ? thisIdx : 0).forEach(prev => {
      let prevTerms = [];
      try { prevTerms = prev.terms ? JSON.parse(prev.terms) : []; } catch {}
      prevTerms.forEach(t => {
        const tipe = t.tipe || 'DP';
        priorTermsByTipe[tipe] = (priorTermsByTipe[tipe] || 0) + 1;
      });
    });
    data.priorTermsByTipe = priorTermsByTipe;

    const html = generateHTMLProforma(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/proforma/:id/sub-invoice/print
router.get('/proforma/:id/sub-invoice/print', authenticatePrint, async (req, res) => {
  try {
    const proforma = await ProformaInvoice.findByPk(req.params.id, {
      include: [{
        model: PenjualanInterior, as: 'penjualan',
        include: [
          { model: PenjualanInteriorItem, as: 'items' },
          { model: Provinsi, as: 'alamatProvinsi' },
          { model: Kabupaten, as: 'alamatKabupaten' },
          { model: Kecamatan, as: 'alamatKecamatan' },
          { model: Kelurahan, as: 'alamatKelurahan' },
        ],
      }],
    });
    if (!proforma) return res.status(404).json({ message: 'Proforma tidak ditemukan' });

    const html = generateHTMLSubInvoice(proforma.toJSON());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/surat-jalan-interior/:id/print
router.get('/surat-jalan-interior/:id/print', authenticatePrint, async (req, res) => {
  try {
    const sji = await SuratJalanInterior.findByPk(req.params.id, {
      include: [
        {
          model: PenjualanInterior, as: 'penjualan',
          include: [
            { model: Provinsi, as: 'alamatProvinsi' },
            { model: Kabupaten, as: 'alamatKabupaten' },
            { model: Kecamatan, as: 'alamatKecamatan' },
            { model: Kelurahan, as: 'alamatKelurahan' },
          ],
        },
        {
          model: SuratJalanInteriorItem, as: 'items',
          include: [{ model: PenjualanInteriorItem, as: 'item' }],
        },
      ],
    });
    if (!sji) return res.status(404).json({ message: 'Surat Jalan Interior tidak ditemukan' });

    const data = sji.toJSON();

    // Normalize data structure agar bisa dipakai oleh generateHTMLSuratJalan
    const normalized = {
      nomor_surat: data.nomor_surat,
      tanggal: data.tanggal,
      catatan: data.catatan,
      penjualan: {
        nama_penerima: data.penjualan.nama_customer,
        pengirim_detail: data.penjualan.alamat_detail,
        pengirimProvinsi: data.penjualan.alamatProvinsi,
        pengirimKabupaten: data.penjualan.alamatKabupaten,
        pengirimKecamatan: data.penjualan.alamatKecamatan,
        pengirimKelurahan: data.penjualan.alamatKelurahan,
        pengirim_kode_pos: data.penjualan.alamat_kode_pos,
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
router.get('/invoice-interior/:id/print', authenticatePrint, async (req, res) => {
  try {
    const inv = await InvoiceInterior.findByPk(req.params.id, {
      include: [{
        model: PenjualanInterior, as: 'penjualan',
        include: [
          { model: Provinsi, as: 'alamatProvinsi' },
          { model: Kabupaten, as: 'alamatKabupaten' },
          { model: Kecamatan, as: 'alamatKecamatan' },
          { model: Kelurahan, as: 'alamatKelurahan' },
        ],
      }],
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

    // Load all referenced SJs
    const suratJalans = await SuratJalanInterior.findAll({
      where: { id: sjIds },
      include: [
        {
          model: SuratJalanInteriorItem, as: 'items',
          include: [{ model: PenjualanInteriorItem, as: 'item' }],
        },
      ],
    });

    // PPN dari penjualan interior
    const ppnPersen = data.penjualan.pakai_ppn && data.penjualan.ppn_persen
      ? parseInt(data.penjualan.ppn_persen) : 0;

    // Merge items dari semua SJ — qty_kirim penuh (retur tidak dikurangi di invoice)
    let invoiceItems = suratJalans.flatMap(sj =>
      (sj.items || []).map(i => {
        const hargaBase = parseFloat(i.item?.harga_satuan || 0);
        const hargaInc = ppnPersen > 0 ? Math.round(hargaBase * (1 + ppnPersen / 100)) : hargaBase;
        return {
          barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang },
          qty: i.qty_kirim,
          harga_satuan: hargaInc,
          subtotal: hargaInc * i.qty_kirim,
        };
      })
    );

    // Fallback: jika tidak ada item dari SJ (misal SJ belum punya item), ambil langsung dari penjualan
    if (invoiceItems.length === 0) {
      const pItems = await PenjualanInteriorItem.findAll({
        where: { penjualan_interior_id: data.penjualan_interior_id },
      });
      invoiceItems = pItems.map(i => {
        const hargaBase = parseFloat(i.harga_satuan || 0);
        const hargaInc = ppnPersen > 0 ? Math.round(hargaBase * (1 + ppnPersen / 100)) : hargaBase;
        return {
          barang: { id: i.kode_barang, nama: i.nama_barang },
          qty: i.qty,
          harga_satuan: hargaInc,
          subtotal: hargaInc * i.qty,
        };
      });
    }

    const normalized = {
      nomor_invoice: data.nomor_invoice,
      tanggal: data.tanggal,
      jatuh_tempo: data.jatuh_tempo,
      catatan: data.catatan,
      ppn_persen: 0, // sudah embedded di harga_satuan
      penjualan: {
        nama_penerima: data.penjualan.nama_customer,
        nama_npwp: data.penjualan.nama_pt_npwp,
        pengirim_detail: data.penjualan.alamat_detail,
        pengirimProvinsi: data.penjualan.alamatProvinsi,
        pengirimKabupaten: data.penjualan.alamatKabupaten,
        pengirimKecamatan: data.penjualan.alamatKecamatan,
        pengirimKelurahan: data.penjualan.alamatKelurahan,
        pengirim_kode_pos: data.penjualan.alamat_kode_pos,
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
router.get('/sp-interior/:id/print', authenticatePrint, async (req, res) => {
  try {
    const { Provinsi: P, Kabupaten: Kab, Kecamatan: Kec, Kelurahan: Kel } = require('../models');
    const sp = await SuratPengantarInterior.findByPk(req.params.id, {
      include: [
        {
          model: PenjualanInterior, as: 'penjualan',
          include: [
            { model: P, as: 'alamatProvinsi' },
            { model: Kab, as: 'alamatKabupaten' },
            { model: Kec, as: 'alamatKecamatan' },
            { model: Kel, as: 'alamatKelurahan' },
          ],
        },
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
