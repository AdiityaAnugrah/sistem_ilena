const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  PenjualanInterior, PenjualanInteriorItem, ProformaInvoice, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, InvoiceInterior,
  ReturSJInterior, LogActivity,
  SuratPengantarInterior, SuratPengantarInteriorItem,
  Provinsi, Kabupaten, Kecamatan, Kelurahan,
} = require('../models');
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');
const { generateNomorProforma, generateNomorSJ, generateNomorInvoice, generateNomorSPInt } = require('../utils/generateNomor');
const { emitDataUpdated } = require('../socket');

const router = express.Router();

const fullInclude = [
  { model: PenjualanInteriorItem, as: 'items' },
  { model: Provinsi, as: 'alamatProvinsi' },
  { model: Kabupaten, as: 'alamatKabupaten' },
  { model: Kecamatan, as: 'alamatKecamatan' },
  { model: Kelurahan, as: 'alamatKelurahan' },
  { model: ProformaInvoice, as: 'proformas' },
  { model: PembayaranInterior, as: 'pembayarans' },
  {
    model: SuratJalanInterior, as: 'suratJalans',
    include: [
      { model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] },
      { model: ReturSJInterior, as: 'returs' },
    ],
  },
  { model: InvoiceInterior, as: 'invoices' },
  { model: SuratPengantarInterior, as: 'suratPengantars', include: [{ model: SuratPengantarInteriorItem, as: 'items' }] },
];

// POST /api/penjualan-interior
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      faktur, no_po, nama_customer, nama_pt_npwp, no_hp, no_npwp,
      pakai_ppn, ppn_persen, tanggal, items,
      alamat_provinsi_id, alamat_kabupaten_id, alamat_kecamatan_id, alamat_kelurahan_id,
      alamat_detail, alamat_kode_pos,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 item wajib diisi' });
    }

    const penjualan = await PenjualanInterior.create({
      faktur, no_po, nama_customer, nama_pt_npwp, no_hp, no_npwp,
      pakai_ppn: pakai_ppn ? 1 : 0,
      ppn_persen: pakai_ppn ? ppn_persen : null,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      alamat_provinsi_id: alamat_provinsi_id || null,
      alamat_kabupaten_id: alamat_kabupaten_id || null,
      alamat_kecamatan_id: alamat_kecamatan_id || null,
      alamat_kelurahan_id: alamat_kelurahan_id || null,
      alamat_detail: alamat_detail || null,
      alamat_kode_pos: alamat_kode_pos || null,
      status: 'ACTIVE',
      is_test: req.user.role === 'TEST' ? 1 : 0,
      created_by: req.user.id,
    });

    const itemsData = items.map(item => ({
      penjualan_interior_id: penjualan.id,
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      qty: item.qty,
      harga_satuan: item.harga_satuan,
      subtotal: item.qty * item.harga_satuan,
      sudah_kirim: 0,
    }));
    await PenjualanInteriorItem.bulkCreate(itemsData);

    await logAction(req.user.id, 'BUAT_PENJUALAN_INTERIOR', `ID: ${penjualan.id}, PO: ${no_po}`, req.ip);
    return res.status(201).json({ id: penjualan.id, message: 'Penjualan interior berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/penjualan-interior
router.get('/', authenticate, async (req, res) => {
  try {
    const { faktur, status, search, page = 1, limit = 20 } = req.query;
    const where = { is_test: req.user.role === 'TEST' ? 1 : 0 };
    if (faktur) where.faktur = faktur;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { nama_customer: { [Op.like]: `%${search}%` } },
        { no_po: { [Op.like]: `%${search}%` } },
        { nama_pt_npwp: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await PenjualanInterior.findAndCountAll({
      where,
      include: [{ model: PenjualanInteriorItem, as: 'items' }],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      distinct: true,
    });

    return res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/penjualan-interior/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id, { include: fullInclude });
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    return res.json(penjualan);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/proforma
router.post('/:id/proforma', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id, {
      include: [{ model: PenjualanInteriorItem, as: 'items' }],
    });
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    const subtotal = penjualan.items.reduce((s, i) => s + parseFloat(i.subtotal), 0);
    let total = subtotal;
    if (penjualan.pakai_ppn && penjualan.ppn_persen) {
      total = subtotal * (1 + parseInt(penjualan.ppn_persen) / 100);
    }

    const nomor_proforma = await generateNomorProforma(tanggal, penjualan.is_test === 1);
    const terms = req.body.terms && req.body.terms.length > 0
      ? JSON.stringify(req.body.terms)
      : null;
    const proforma = await ProformaInvoice.create({
      penjualan_interior_id: penjualan.id,
      nomor_proforma,
      tanggal,
      total,
      catatan: req.body.catatan || null,
      terms,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_PROFORMA', `Nomor: ${nomor_proforma}`, req.ip);
    emitDataUpdated(`penjualan-interior:${req.params.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: proforma.id, nomor_proforma, total, message: 'Proforma berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/pembayaran
router.post('/:id/pembayaran', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id, {
      include: [{ model: PembayaranInterior, as: 'pembayarans' }],
    });
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { tipe, jumlah, tanggal, catatan } = req.body;

    // Business rule: termin/pelunasan wajib sudah ada DP
    if (['TERMIN_1', 'TERMIN_2', 'TERMIN_3', 'PELUNASAN_AKHIR'].includes(tipe)) {
      const hasDP = penjualan.pembayarans.some(p => p.tipe === 'DP');
      if (!hasDP) {
        return res.status(400).json({ message: 'Wajib ada pembayaran DP sebelum termin/pelunasan' });
      }
    }

    const pembayaran = await PembayaranInterior.create({
      penjualan_interior_id: penjualan.id,
      tipe,
      jumlah,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      catatan: catatan || null,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_PEMBAYARAN', `Tipe: ${tipe}, Jumlah: ${jumlah}`, req.ip);
    emitDataUpdated(`penjualan-interior:${req.params.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: pembayaran.id, message: 'Pembayaran berhasil ditambahkan' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/surat-jalan
router.post('/:id/surat-jalan', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { tanggal, catatan, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 item wajib dipilih' });
    }

    const sjTanggal = tanggal || new Date().toISOString().split('T')[0];
    const nomor_surat = await generateNomorSJ(penjualan.faktur, sjTanggal, penjualan.is_test === 1);

    const sj = await SuratJalanInterior.create({
      penjualan_interior_id: penjualan.id,
      nomor_surat,
      tanggal: sjTanggal,
      catatan: catatan || null,
      created_by: req.user.id,
    });

    for (const item of items) {
      await SuratJalanInteriorItem.create({
        surat_jalan_interior_id: sj.id,
        penjualan_interior_item_id: item.penjualan_interior_item_id,
        qty_kirim: item.qty_kirim,
      });
      // Update sudah_kirim
      const piItem = await PenjualanInteriorItem.findByPk(item.penjualan_interior_item_id);
      if (piItem) {
        await piItem.update({ sudah_kirim: piItem.sudah_kirim + item.qty_kirim });
      }
    }

    await logAction(req.user.id, 'BUAT_SJ_INTERIOR', `Nomor: ${nomor_surat}`, req.ip);
    emitDataUpdated(`penjualan-interior:${req.params.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: sj.id, nomor_surat, message: 'Surat Jalan interior berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/invoice
router.post('/:id/invoice', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { tanggal, catatan, surat_jalan_ids } = req.body;
    const sjIds = Array.isArray(surat_jalan_ids) ? surat_jalan_ids.filter(Boolean) : [];
    if (sjIds.length === 0) return res.status(400).json({ message: 'Minimal 1 Surat Jalan wajib dipilih' });

    // Cek apakah ada SJ yang sudah dipakai di invoice lain
    const existingInvoices = await InvoiceInterior.findAll({
      where: { penjualan_interior_id: penjualan.id },
      attributes: ['nomor_invoice', 'surat_jalan_interior_id', 'surat_jalan_ids'],
    });
    const usedSjIds = new Set();
    for (const inv of existingInvoices) {
      if (inv.surat_jalan_ids) {
        try { JSON.parse(inv.surat_jalan_ids).forEach(id => usedSjIds.add(Number(id))); } catch { /* skip */ }
      } else if (inv.surat_jalan_interior_id) {
        usedSjIds.add(Number(inv.surat_jalan_interior_id));
      }
    }
    const duplicate = sjIds.find(id => usedSjIds.has(Number(id)));
    if (duplicate) {
      const conflictInv = existingInvoices.find(inv => {
        if (inv.surat_jalan_ids) {
          try { return JSON.parse(inv.surat_jalan_ids).map(Number).includes(Number(duplicate)); } catch { return false; }
        }
        return Number(inv.surat_jalan_interior_id) === Number(duplicate);
      });
      return res.status(400).json({
        message: `Surat Jalan ini sudah digunakan pada Invoice ${conflictInv?.nomor_invoice || 'lain'}. Tidak boleh dibuat invoice duplikat.`,
      });
    }

    const invTanggal = tanggal || new Date().toISOString().split('T')[0];
    const nomor_invoice = await generateNomorInvoice(penjualan.faktur, invTanggal, penjualan.is_test === 1);
    const jatuh_tempo = new Date(new Date(invTanggal).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const inv = await InvoiceInterior.create({
      penjualan_interior_id: penjualan.id,
      surat_jalan_interior_id: sjIds[0] || null, // backward compat: first SJ as primary
      surat_jalan_ids: sjIds.length > 0 ? JSON.stringify(sjIds) : null,
      nomor_invoice,
      tanggal: invTanggal,
      jatuh_tempo,
      catatan: catatan || null,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_INVOICE_INTERIOR', `Nomor: ${nomor_invoice}`, req.ip);
    emitDataUpdated(`penjualan-interior:${req.params.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: inv.id, nomor_invoice, message: 'Invoice interior berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/retur-sj
router.post('/:id/retur-sj', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id, { transaction: t });
    if (!penjualan) { await t.rollback(); return res.status(404).json({ message: 'Penjualan tidak ditemukan' }); }

    const { surat_jalan_interior_id, tanggal, catatan, items } = req.body;

    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 item retur wajib diisi' });
    }

    // Validate SJ belongs to this penjualan
    const sj = await SuratJalanInterior.findOne({
      where: { id: surat_jalan_interior_id, penjualan_interior_id: req.params.id },
      transaction: t,
    });
    if (!sj) { await t.rollback(); return res.status(400).json({ message: 'Surat Jalan tidak ditemukan atau bukan milik penjualan ini' }); }

    for (const item of items) {
      const { penjualan_interior_item_id, qty_retur } = item;

      if (!qty_retur || qty_retur <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Qty retur harus lebih dari 0' });
      }

      const sjItem = await SuratJalanInteriorItem.findOne({
        where: { surat_jalan_interior_id, penjualan_interior_item_id },
        transaction: t,
      });
      if (!sjItem) {
        await t.rollback();
        return res.status(400).json({ message: 'Item tidak ditemukan pada Surat Jalan ini' });
      }
      if (qty_retur > sjItem.qty_kirim) {
        await t.rollback();
        return res.status(400).json({ message: 'Qty retur melebihi qty kirim pada SJ ini' });
      }

      await ReturSJInterior.create({
        surat_jalan_interior_id,
        penjualan_interior_item_id,
        qty_retur,
        tanggal,
        catatan: catatan || null,
        created_by: req.user.id,
      }, { transaction: t });

      await PenjualanInteriorItem.decrement('sudah_kirim', {
        by: qty_retur,
        where: { id: penjualan_interior_item_id },
        transaction: t,
      });
    }

    await t.commit();

    await logAction(req.user.id, 'CATAT_RETUR_SJ_INTERIOR',
      `Retur SJ #${surat_jalan_interior_id} untuk Penjualan Interior #${req.params.id}`, req.ip);
    res.status(201).json({ message: 'Retur berhasil dicatat' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-interior/:id/sp-from-retur
router.post('/:id/sp-from-retur', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id, { transaction: t });
    if (!penjualan) { await t.rollback(); return res.status(404).json({ message: 'Penjualan tidak ditemukan' }); }

    const { surat_jalan_interior_id, tanggal, keterangan } = req.body;
    if (!tanggal) { await t.rollback(); return res.status(400).json({ message: 'Tanggal wajib diisi' }); }

    const sj = await SuratJalanInterior.findOne({
      where: { id: surat_jalan_interior_id, penjualan_interior_id: req.params.id },
      transaction: t,
    });
    if (!sj) { await t.rollback(); return res.status(400).json({ message: 'Surat Jalan tidak ditemukan' }); }

    const returs = await ReturSJInterior.findAll({
      where: { surat_jalan_interior_id },
      transaction: t,
    });
    if (!returs.length) { await t.rollback(); return res.status(400).json({ message: 'Tidak ada data retur untuk SJ ini' }); }

    // Aggregate qty retur per item
    const itemMap = {};
    for (const r of returs) {
      const k = r.penjualan_interior_item_id;
      itemMap[k] = (itemMap[k] || 0) + r.qty_retur;
    }

    const isTest = penjualan.is_test === 1;
    const nomorSP = await generateNomorSPInt(tanggal, isTest);
    const sp = await SuratPengantarInterior.create({
      nomor_surat: nomorSP,
      tanggal,
      penjualan_interior_id: req.params.id,
      surat_jalan_interior_id,
      catatan: keterangan || null,
      created_by: req.user.id,
    }, { transaction: t });

    for (const [penjualan_interior_item_id, qty] of Object.entries(itemMap)) {
      const pjItem = await PenjualanInteriorItem.findByPk(penjualan_interior_item_id, { transaction: t });
      await SuratPengantarInteriorItem.create({
        surat_pengantar_interior_id: sp.id,
        penjualan_interior_item_id: Number(penjualan_interior_item_id),
        kode_barang: pjItem?.kode_barang || null,
        nama_barang: pjItem?.nama_barang || '-',
        qty,
      }, { transaction: t });

      // Barang dikembalikan ke customer → sudah_kirim naik kembali
      await PenjualanInteriorItem.increment('sudah_kirim', {
        by: qty,
        where: { id: Number(penjualan_interior_item_id) },
        transaction: t,
      });
    }

    await t.commit();
    await logAction(req.user.id, 'BUAT_SP_INTERIOR_RETUR',
      `SP/INT ${nomorSP} dari retur SJ #${surat_jalan_interior_id}`, req.ip);
    res.status(201).json({ message: 'Surat Pengantar Interior berhasil dibuat', nomor_sp: nomorSP });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/penjualan-interior/:id/identitas - edit identitas customer
router.patch('/:id/identitas', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { nama_customer, nama_pt_npwp, no_hp, no_po, no_npwp } = req.body;

    const updates = {};
    if (nama_customer !== undefined) updates.nama_customer = nama_customer;
    if (nama_pt_npwp !== undefined) updates.nama_pt_npwp = nama_pt_npwp;
    if (no_hp !== undefined) updates.no_hp = no_hp;
    if (no_po !== undefined) updates.no_po = no_po;
    if (no_npwp !== undefined) updates.no_npwp = no_npwp;

    await penjualan.update(updates);
    await logAction(req.user.id, 'EDIT_IDENTITAS_INTERIOR', `Edit identitas penjualan interior #${penjualan.id}`, req.ip);
    emitDataUpdated(`penjualan-interior:${penjualan.id}`, { updatedBy: req.user.id });

    return res.json({ message: 'Identitas berhasil diperbarui' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
