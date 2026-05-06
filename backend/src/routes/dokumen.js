const express = require('express');
const { Op } = require('sequelize');
const {
  SuratJalan, Invoice, SuratPengantar, SuratPengantarSub, ProformaInvoice,
  PenjualanOffline, PenjualanOfflineItem, ReturOffline, Barang,
  Provinsi, Kabupaten, Kecamatan, Kelurahan,
  PenjualanInterior, PenjualanInteriorItem, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem,
  InvoiceInterior, SuratPengantarInterior, SuratPengantarInteriorItem,
  DocumentCounter,
  sequelize,
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
const { authenticate, authenticatePrint, requireDev } = require('../middleware/auth');
const { generateNomorInvoice } = require('../utils/generateNomor');
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
const { sendDocumentEmail } = require('../utils/mailer');
const { htmlToPdf } = require('../utils/htmlToPdf');
const fs = require('fs');
const path = require('path');
const SIGS_DIR = path.join(__dirname, '../../uploads/signatures');

// Inject signature image into the first sig-body (Dibuat Oleh) of a document HTML
function injectSignatureHtml(html, signatureId) {
  if (!signatureId) return html;
  const filename = decodeURIComponent(signatureId);
  if (!/^[\w\-. ]+\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) return html;
  const filepath = path.join(SIGS_DIR, filename);
  if (!fs.existsSync(filepath)) return html;
  const buf = fs.readFileSync(filepath);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const dataUri = `data:image/${mime};base64,${buf.toString('base64')}`;
  const imgTag = `<img src="${dataUri}" style="max-height:76px;max-width:130px;object-fit:contain;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;mix-blend-mode:multiply;-webkit-print-color-adjust:exact;print-color-adjust:exact;" alt="TTD">`;
  return html.replace('<div class="sig-body">', `<div class="sig-body">${imgTag}`);
}

const router = express.Router();

// Hapus CSP untuk semua dokumen print (template HTML butuh inline script + CDN)
router.use((_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options'); // agar gambar dari origin lain bisa dimuat
  next();
});

async function fetchSuratJalan(id) {
  const sj = await SuratJalan.findByPk(id, {
    include: [{
      model: PenjualanOffline, as: 'penjualan',
      include: [
        { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
        { model: ReturOffline, as: 'returs' },
        ...includeAlamat,
      ],
    }],
  });
  if (!sj) return null;
  return { html: generateHTMLSuratJalan(sj.toJSON()), nomor: sj.nomor_surat, tanggal: sj.tanggal, nama: sj.penjualan?.nama_penerima };
}

// GET /api/dokumen/surat-jalan/:id/print
router.get('/surat-jalan/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchSuratJalan(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/surat-jalan/:id/email
router.post('/surat-jalan/:id/email', authenticate, async (req, res) => {
  try {
    const { email, signatureId } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSuratJalan(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    const html = injectSignatureHtml(doc.html, signatureId);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Surat Jalan - ${doc.nomor}`, tipeLabel: 'Surat Jalan', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Surat_Jalan_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    console.error('[email/surat-jalan] Error:', err.message, err.stack?.split('\n')[1]);
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchInvoice(id) {
  const inv = await Invoice.findByPk(id, {
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
  if (!inv) return null;
  const data = inv.toJSON();
  if (data.penjualan) data.penjualan.items = applyReturs(data.penjualan.items || [], data.penjualan.returs || []);
  return { html: generateHTMLInvoice(data), nomor: inv.nomor_invoice, tanggal: inv.tanggal, nama: inv.penjualan?.nama_penerima };
}

// GET /api/dokumen/invoice/:id/print
router.get('/invoice/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchInvoice(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/invoice/:id/email
router.post('/invoice/:id/email', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchInvoice(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    const pdf = await htmlToPdf(doc.html);
    await sendDocumentEmail({ to: email, subject: `Invoice - ${doc.nomor}`, tipeLabel: 'Invoice', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Invoice_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchSuratPengantar(id) {
  const sp = await SuratPengantar.findByPk(id, {
    include: [{
      model: PenjualanOffline, as: 'penjualan',
      include: [
        { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
        { model: ReturOffline, as: 'returs' },
        ...includeAlamat,
      ],
    }],
  });
  if (!sp) return null;
  const data = sp.toJSON();
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
  return { html: generateHTMLSuratPengantar(data), nomor: sp.nomor_sp, tanggal: sp.tanggal, nama: sp.penjualan?.nama_penerima };
}

// GET /api/dokumen/sp/:id/print
router.get('/sp/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchSuratPengantar(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Pengantar tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/sp/:id/email
router.post('/sp/:id/email', authenticate, async (req, res) => {
  try {
    const { email, signatureId } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSuratPengantar(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Pengantar tidak ditemukan' });
    const html = injectSignatureHtml(doc.html, signatureId);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Surat Pengantar - ${doc.nomor}`, tipeLabel: 'Surat Pengantar', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Surat_Pengantar_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchSpSub(id) {
  const sub = await SuratPengantarSub.findByPk(id, {
    include: [
      {
        model: SuratPengantar, as: 'suratPengantar',
        include: [{ model: PenjualanOffline, as: 'penjualan', include: [...includeAlamat] }],
      },
      { model: PenjualanOfflineItem, as: 'item', include: [{ model: Barang, as: 'barang' }] },
    ],
  });
  if (!sub) return null;
  const data = sub.toJSON();
  const spData = {
    ...data.suratPengantar,
    nomor_sp: data.nomor_sp_sub,
    penjualan: { ...data.suratPengantar.penjualan, items: [data.item] },
  };
  return { html: generateHTMLSuratPengantar(spData), nomor: data.nomor_sp_sub, tanggal: data.suratPengantar.tanggal, nama: data.suratPengantar.penjualan?.nama_penerima };
}

// GET /api/dokumen/sp-sub/:id/print
router.get('/sp-sub/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchSpSub(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Sub-SP tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/sp-sub/:id/email
router.post('/sp-sub/:id/email', authenticate, async (req, res) => {
  try {
    const { email, signatureId } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSpSub(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Sub-SP tidak ditemukan' });
    const html = injectSignatureHtml(doc.html, signatureId);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Surat Pengantar - ${doc.nomor}`, tipeLabel: 'Surat Pengantar', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Surat_Pengantar_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchProforma(id) {
  const proforma = await ProformaInvoice.findByPk(id, {
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
  if (!proforma) return null;
  const data = proforma.toJSON();
  const allProformas = (data.penjualan.proformas || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const thisIdx = allProformas.findIndex(p => p.id === proforma.id);
  const priorTermsByTipe = {};
  allProformas.slice(0, thisIdx >= 0 ? thisIdx : 0).forEach(prev => {
    let prevTerms = [];
    try { prevTerms = prev.terms ? JSON.parse(prev.terms) : []; } catch {}
    prevTerms.forEach(t => { const tipe = t.tipe || 'DP'; priorTermsByTipe[tipe] = (priorTermsByTipe[tipe] || 0) + 1; });
  });
  data.priorTermsByTipe = priorTermsByTipe;
  return { html: generateHTMLProforma(data), nomor: proforma.nomor_proforma, tanggal: proforma.tanggal, nama: proforma.penjualan?.nama_customer };
}

// GET /api/dokumen/proforma/:id/print
router.get('/proforma/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchProforma(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/proforma/:id/email
router.post('/proforma/:id/email', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchProforma(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    const pdf = await htmlToPdf(doc.html);
    await sendDocumentEmail({ to: email, subject: `Proforma Invoice - ${doc.nomor}`, tipeLabel: 'Proforma Invoice', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Proforma_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchSubInvoice(id) {
  const proforma = await ProformaInvoice.findByPk(id, {
    include: [{
      model: PenjualanInterior, as: 'penjualan',
      include: [
        { model: PenjualanInteriorItem, as: 'items' },
        { model: Provinsi, as: 'alamatProvinsi' },
        { model: Kabupaten, as: 'alamatKabupaten' },
        { model: Kecamatan, as: 'alamatKecamatan' },
        { model: Kelurahan, as: 'alamatKelurahan' },
        { model: SuratJalanInterior, as: 'suratJalans', attributes: ['id', 'nomor_surat'] },
      ],
    }],
  });
  if (!proforma) return null;
  if (!proforma.nomor_sub_invoice) {
    const faktur = proforma.penjualan?.faktur || 'NON_FAKTUR';
    const nomor = await generateNomorInvoice(faktur, proforma.tanggal, proforma.penjualan?.is_test === 1);
    await proforma.update({ nomor_sub_invoice: nomor });
  }
  const data = proforma.toJSON();

  // Resolve surat jalan nomors from sub_invoice_sj_ids
  let sjNomors = [];
  if (data.sub_invoice_sj_ids) {
    try {
      const sjIds = JSON.parse(data.sub_invoice_sj_ids).map(Number);
      const allSjs = data.penjualan?.suratJalans || [];
      sjNomors = allSjs.filter(sj => sjIds.includes(sj.id)).map(sj => sj.nomor_surat);
    } catch { /* ignore */ }
  }

  return { html: generateHTMLSubInvoice(data, sjNomors), nomor: data.nomor_sub_invoice, tanggal: data.tanggal, nama: data.penjualan?.nama_customer };
}

// PUT /api/dokumen/proforma/:id/sub-invoice/surat-jalan — simpan SJ IDs untuk sub invoice
router.put('/proforma/:id/sub-invoice/surat-jalan', authenticate, async (req, res) => {
  try {
    const { surat_jalan_ids } = req.body;
    if (!Array.isArray(surat_jalan_ids)) {
      return res.status(400).json({ message: 'surat_jalan_ids harus berupa array' });
    }
    const proforma = await ProformaInvoice.findByPk(req.params.id);
    if (!proforma) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    await proforma.update({ sub_invoice_sj_ids: surat_jalan_ids.length > 0 ? JSON.stringify(surat_jalan_ids) : null });
    return res.json({ message: 'Surat Jalan berhasil disimpan' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dokumen/proforma/:id/sub-invoice/print
router.get('/proforma/:id/sub-invoice/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchSubInvoice(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Proforma tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/proforma/:id/sub-invoice/email
router.post('/proforma/:id/sub-invoice/email', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSubInvoice(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Sub Invoice tidak ditemukan' });
    const pdf = await htmlToPdf(doc.html);
    await sendDocumentEmail({ to: email, subject: `Invoice - ${doc.nomor}`, tipeLabel: 'Invoice', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Invoice_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

// DELETE /api/dokumen/proforma/:id/sub-invoice — hapus nomor sub invoice + renumber yang di atasnya (dev only)
router.delete('/proforma/:id/sub-invoice', authenticate, requireDev, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const proforma = await ProformaInvoice.findByPk(req.params.id, {
      include: [{ model: PenjualanInterior, as: 'penjualan', attributes: ['id', 'faktur', 'is_test'] }],
      transaction: t,
    });
    if (!proforma) { await t.rollback(); return res.status(404).json({ message: 'Proforma tidak ditemukan' }); }
    if (!proforma.nomor_sub_invoice) { await t.rollback(); return res.status(400).json({ message: 'Sub invoice belum dibuat' }); }

    const nomor = proforma.nomor_sub_invoice;
    const m = nomor.match(/^((?:TEST-)?(?:NF)?)(\d+)(.*)$/);
    if (!m) { await t.rollback(); return res.status(400).json({ message: 'Format nomor tidak dikenali' }); }

    const prefix = m[1];
    const deletedNum = parseInt(m[2], 10);
    const padLen = m[2].length;
    const suffix = m[3]; // misal: /INV/CBM/12/2025

    const tahun = parseInt(suffix.split('/').pop(), 10);
    const isTest = proforma.penjualan?.is_test === 1;
    const faktur = proforma.penjualan?.faktur || 'NON_FAKTUR';
    const counterTipe = isTest
      ? (faktur === 'FAKTUR' ? 'TEST_INV_FAKTUR' : 'TEST_INV_NON_FAKTUR')
      : (faktur === 'FAKTUR' ? 'INV_FAKTUR' : 'INV_NON_FAKTUR');

    // Null-kan nomor dan SJ IDs yang dihapus
    await proforma.update({ nomor_sub_invoice: null, sub_invoice_sj_ids: null }, { transaction: t });

    // Renumber semua Invoice (offline + interior) dan sub invoice dengan nomor lebih besar
    const likePattern = `%${suffix}`;

    const [offlineInvs, interiorInvs, subInvs] = await Promise.all([
      Invoice.findAll({ where: { nomor_invoice: { [Op.like]: likePattern } }, transaction: t, lock: t.LOCK.UPDATE }),
      InvoiceInterior.findAll({ where: { nomor_invoice: { [Op.like]: likePattern } }, transaction: t, lock: t.LOCK.UPDATE }),
      ProformaInvoice.findAll({ where: { nomor_sub_invoice: { [Op.like]: likePattern } }, transaction: t, lock: t.LOCK.UPDATE }),
    ]);

    const renumberDoc = async (doc, field) => {
      const val = doc[field];
      const dm = val.match(/^((?:TEST-)?(?:NF)?)(\d+)(.*)$/);
      if (!dm || dm[1] !== prefix || dm[3] !== suffix) return;
      const num = parseInt(dm[2], 10);
      if (num <= deletedNum) return;
      const newNomor = `${prefix}${String(num - 1).padStart(padLen, '0')}${suffix}`;
      await doc.update({ [field]: newNomor }, { transaction: t });
    };

    for (const doc of offlineInvs) await renumberDoc(doc, 'nomor_invoice');
    for (const doc of interiorInvs) await renumberDoc(doc, 'nomor_invoice');
    for (const doc of subInvs) await renumberDoc(doc, 'nomor_sub_invoice');

    // Decrement counter
    const counter = await DocumentCounter.findOne({ where: { tipe: counterTipe, bulan: 0, tahun }, transaction: t });
    if (counter && counter.last_number > 0) {
      counter.last_number -= 1;
      await counter.save({ transaction: t });
    }

    await t.commit();
    return res.json({ message: 'Sub invoice berhasil dihapus dan nomor disesuaikan' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Gagal menghapus sub invoice', error: err.message });
  }
});

async function fetchSuratJalanInterior(id) {
  const sji = await SuratJalanInterior.findByPk(id, {
    include: [
      { model: PenjualanInterior, as: 'penjualan', include: [{ model: Provinsi, as: 'alamatProvinsi' }, { model: Kabupaten, as: 'alamatKabupaten' }, { model: Kecamatan, as: 'alamatKecamatan' }, { model: Kelurahan, as: 'alamatKelurahan' }] },
      { model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] },
    ],
  });
  if (!sji) return null;
  const data = sji.toJSON();
  const normalized = { nomor_surat: data.nomor_surat, tanggal: data.tanggal, catatan: data.catatan, penjualan: { nama_penerima: data.penjualan.nama_customer, pengirim_detail: data.penjualan.alamat_detail, pengirimProvinsi: data.penjualan.alamatProvinsi, pengirimKabupaten: data.penjualan.alamatKabupaten, pengirimKecamatan: data.penjualan.alamatKecamatan, pengirimKelurahan: data.penjualan.alamatKelurahan, pengirim_kode_pos: data.penjualan.alamat_kode_pos, faktur: data.penjualan.faktur, items: (data.items || []).map(i => ({ barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang }, qty: i.qty_kirim, barang_id: i.penjualan_interior_item_id })) } };
  return { html: generateHTMLSuratJalan(normalized), nomor: sji.nomor_surat, tanggal: sji.tanggal, nama: sji.penjualan?.nama_customer };
}

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

// POST /api/dokumen/surat-jalan-interior/:id/email
router.post('/surat-jalan-interior/:id/email', authenticate, async (req, res) => {
  try {
    const { email, signatureId } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSuratJalanInterior(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Jalan Interior tidak ditemukan' });
    const html = injectSignatureHtml(doc.html, signatureId);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Surat Jalan - ${doc.nomor}`, tipeLabel: 'Surat Jalan', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Surat_Jalan_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
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

    // Kumpulkan semua item dari semua SJ, lalu merge nama barang yang sama
    const rawItems = suratJalans.flatMap(sj =>
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

    // Merge item dengan nama & harga sama (beda SJ, PO sama karena satu penjualan)
    const mergeMap = new Map();
    rawItems.forEach(item => {
      const key = `${item.barang.nama}||${item.harga_satuan}`;
      if (mergeMap.has(key)) {
        const ex = mergeMap.get(key);
        ex.qty += item.qty;
        ex.subtotal += item.subtotal;
      } else {
        mergeMap.set(key, { ...item });
      }
    });
    let invoiceItems = Array.from(mergeMap.values());

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

// POST /api/dokumen/invoice-interior/:id/email
router.post('/invoice-interior/:id/email', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    // Re-use the print logic by calling the same handler inline via a lightweight helper
    const inv = await InvoiceInterior.findByPk(req.params.id, { include: [{ model: PenjualanInterior, as: 'penjualan', include: [{ model: Provinsi, as: 'alamatProvinsi' }, { model: Kabupaten, as: 'alamatKabupaten' }, { model: Kecamatan, as: 'alamatKecamatan' }, { model: Kelurahan, as: 'alamatKelurahan' }] }] });
    if (!inv) return res.status(404).json({ message: 'Invoice Interior tidak ditemukan' });
    const data = inv.toJSON();
    let sjIds = [];
    if (data.surat_jalan_ids) { try { sjIds = JSON.parse(data.surat_jalan_ids); } catch { sjIds = []; } } else if (data.surat_jalan_interior_id) { sjIds = [data.surat_jalan_interior_id]; }
    const suratJalans = await SuratJalanInterior.findAll({ where: { id: sjIds }, include: [{ model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] }] });
    const ppnPersen = data.penjualan.pakai_ppn && data.penjualan.ppn_persen ? parseInt(data.penjualan.ppn_persen) : 0;
    const rawItems = suratJalans.flatMap(sj => (sj.items || []).map(i => { const hb = parseFloat(i.item?.harga_satuan || 0); const hi = ppnPersen > 0 ? Math.round(hb * (1 + ppnPersen / 100)) : hb; return { barang: { id: i.item?.kode_barang, nama: i.item?.nama_barang }, qty: i.qty_kirim, harga_satuan: hi, subtotal: hi * i.qty_kirim }; }));
    const mergeMap = new Map(); rawItems.forEach(item => { const key = `${item.barang.nama}||${item.harga_satuan}`; if (mergeMap.has(key)) { const ex = mergeMap.get(key); ex.qty += item.qty; ex.subtotal += item.subtotal; } else { mergeMap.set(key, { ...item }); } });
    let invoiceItems = Array.from(mergeMap.values());
    if (invoiceItems.length === 0) { const pItems = await PenjualanInteriorItem.findAll({ where: { penjualan_interior_id: data.penjualan_interior_id } }); invoiceItems = pItems.map(i => { const hb = parseFloat(i.harga_satuan || 0); const hi = ppnPersen > 0 ? Math.round(hb * (1 + ppnPersen / 100)) : hb; return { barang: { id: i.kode_barang, nama: i.nama_barang }, qty: i.qty, harga_satuan: hi, subtotal: hi * i.qty }; }); }
    const normalized = { nomor_invoice: data.nomor_invoice, tanggal: data.tanggal, jatuh_tempo: data.jatuh_tempo, catatan: data.catatan, ppn_persen: 0, penjualan: { nama_penerima: data.penjualan.nama_customer, nama_npwp: data.penjualan.nama_pt_npwp, pengirim_detail: data.penjualan.alamat_detail, pengirimProvinsi: data.penjualan.alamatProvinsi, pengirimKabupaten: data.penjualan.alamatKabupaten, pengirimKecamatan: data.penjualan.alamatKecamatan, pengirimKelurahan: data.penjualan.alamatKelurahan, pengirim_kode_pos: data.penjualan.alamat_kode_pos, no_po: data.penjualan.no_po, no_npwp: data.penjualan.no_npwp, faktur: data.penjualan.faktur, suratJalans: suratJalans.map(sj => ({ nomor_surat: sj.nomor_surat })), items: invoiceItems } };
    const html = generateHTMLInvoice(normalized);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Invoice - ${data.nomor_invoice}`, tipeLabel: 'Invoice', nomor: data.nomor_invoice, namaCustomer: data.penjualan?.nama_customer, tanggal: data.tanggal, pdfBuffer: pdf, pdfFilename: `Invoice_${data.nomor_invoice.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

async function fetchSpInterior(id) {
  const sp = await SuratPengantarInterior.findByPk(id, {
    include: [
      { model: PenjualanInterior, as: 'penjualan', include: [{ model: Provinsi, as: 'alamatProvinsi' }, { model: Kabupaten, as: 'alamatKabupaten' }, { model: Kecamatan, as: 'alamatKecamatan' }, { model: Kelurahan, as: 'alamatKelurahan' }] },
      { model: SuratPengantarInteriorItem, as: 'items' },
    ],
  });
  if (!sp) return null;
  return { html: generateHTMLSuratPengantarInterior(sp.toJSON()), nomor: sp.nomor_surat, tanggal: sp.tanggal, nama: sp.penjualan?.nama_customer };
}

// GET /api/dokumen/sp-interior/:id/print
router.get('/sp-interior/:id/print', authenticatePrint, async (req, res) => {
  try {
    const doc = await fetchSpInterior(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Pengantar Interior tidak ditemukan' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/dokumen/sp-interior/:id/email
router.post('/sp-interior/:id/email', authenticate, async (req, res) => {
  try {
    const { email, signatureId } = req.body;
    if (!email) return res.status(400).json({ message: 'Email tujuan wajib diisi' });
    const doc = await fetchSpInterior(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Surat Pengantar Interior tidak ditemukan' });
    const html = injectSignatureHtml(doc.html, signatureId);
    const pdf = await htmlToPdf(html);
    await sendDocumentEmail({ to: email, subject: `Surat Pengantar - ${doc.nomor}`, tipeLabel: 'Surat Pengantar', nomor: doc.nomor, namaCustomer: doc.nama, tanggal: doc.tanggal, pdfBuffer: pdf, pdfFilename: `Surat_Pengantar_${doc.nomor.replace(/\//g, '-')}.pdf` });
    return res.json({ message: 'Email berhasil dikirim' });
  } catch (err) {
    return res.status(500).json({ message: 'Gagal mengirim email', error: err.message });
  }
});

module.exports = router;
