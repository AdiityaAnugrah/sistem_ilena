const express = require('express');
const { Op } = require('sequelize');
const {
  PenjualanOffline, PenjualanOfflineItem, SuratJalan, Invoice, SuratPengantar, SuratPengantarSub, Barang,
  Provinsi, Kabupaten, Kecamatan, Kelurahan, ReturOffline, sequelize,
} = require('../models');
const BarangTest = require('../models/BarangTest');

// Kembalikan stok varian ke barang saat retur
async function restoreStok(items, isTest) {
  const BarangModel = isTest ? BarangTest : Barang;
  for (const item of items) {
    if (!item.barang_id) continue;
    try {
      const barang = await BarangModel.findByPk(item.barang_id);
      if (!barang || !barang.varian) continue;
      let varians = [];
      try { varians = JSON.parse(barang.varian); } catch { continue; }
      if (!Array.isArray(varians) || varians.length === 0) continue;

      let updated = false;
      if (item.varian_id) {
        varians = varians.map(v => {
          if (String(v.id) === String(item.varian_id)) {
            const stokBaru = Number(v.stok || 0) + item.qty_retur;
            updated = true;
            return { ...v, stok: String(stokBaru) };
          }
          return v;
        });
      } else {
        varians[0] = { ...varians[0], stok: String(Number(varians[0].stok || 0) + item.qty_retur) };
        updated = true;
      }
      if (updated) await barang.update({ varian: JSON.stringify(varians) });
    } catch { /* skip item jika error */ }
  }
}

// Kurangi stok varian pada barang setelah penjualan dibuat
async function deductStok(items, isTest) {
  const BarangModel = isTest ? BarangTest : Barang;
  for (const item of items) {
    if (!item.barang_id) continue;
    try {
      const barang = await BarangModel.findByPk(item.barang_id);
      if (!barang || !barang.varian) continue;
      let varians = [];
      try { varians = JSON.parse(barang.varian); } catch { continue; }
      if (!Array.isArray(varians) || varians.length === 0) continue;

      let updated = false;
      if (item.varian_id) {
        varians = varians.map(v => {
          if (String(v.id) === String(item.varian_id)) {
            const stokBaru = Math.max(0, Number(v.stok || 0) - item.qty);
            updated = true;
            return { ...v, stok: String(stokBaru) };
          }
          return v;
        });
      } else {
        // Tidak ada varian spesifik — kurangi dari varian pertama
        const stokBaru = Math.max(0, Number(varians[0].stok || 0) - item.qty);
        varians[0] = { ...varians[0], stok: String(stokBaru) };
        updated = true;
      }
      if (updated) await barang.update({ varian: JSON.stringify(varians) });
    } catch { /* skip item jika error */ }
  }
}

// Reusable include untuk alamat pengirim & tagihan
const includeAlamat = [
  { model: Provinsi, as: 'pengirimProvinsi' },
  { model: Kabupaten, as: 'pengirimKabupaten' },
  { model: Kecamatan, as: 'pengirimKecamatan' },
  { model: Kelurahan, as: 'pengirimKelurahan' },
  { model: Provinsi, as: 'tagihanProvinsi' },
  { model: Kabupaten, as: 'tagihanKabupaten' },
  { model: Kecamatan, as: 'tagihanKecamatan' },
  { model: Kelurahan, as: 'tagihanKelurahan' },
];
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');
const { generateNomorSJ, generateNomorInvoice, generateNomorSP } = require('../utils/generateNomor');
const { emitDataUpdated } = require('../socket');

const router = express.Router();

const fullInclude = [
  { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
  { model: SuratJalan, as: 'suratJalans' },
  { model: Invoice, as: 'invoices' },
  { model: SuratPengantar, as: 'suratPengantars', include: [{ model: SuratPengantarSub, as: 'subs', include: [{ model: PenjualanOfflineItem, as: 'item', include: [{ model: Barang, as: 'barang' }] }] }] },
  { model: ReturOffline, as: 'returs', include: [{ model: PenjualanOfflineItem, as: 'item' }] },
  ...includeAlamat,
];

// POST /api/penjualan-offline
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      tipe, faktur, nama_penerima, no_hp_penerima, no_po, tanggal,
      nama_npwp, no_npwp,
      pengirim_provinsi_id, pengirim_kabupaten_id, pengirim_kecamatan_id, pengirim_kelurahan_id, pengirim_detail, pengirim_kode_pos,
      tagihan_sama_pengirim, tagihan_provinsi_id, tagihan_kabupaten_id, tagihan_kecamatan_id, tagihan_kelurahan_id, tagihan_detail, tagihan_kode_pos,
      items,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 item produk wajib diisi' });
    }

    const penjualan = await PenjualanOffline.create({
      tipe, faktur, nama_penerima, no_hp_penerima, no_po, tanggal,
      nama_npwp, no_npwp,
      pengirim_provinsi_id, pengirim_kabupaten_id, pengirim_kecamatan_id, pengirim_kelurahan_id, pengirim_detail,
      pengirim_kode_pos: pengirim_kode_pos || null,
      tagihan_sama_pengirim: tagihan_sama_pengirim ? 1 : 0,
      tagihan_provinsi_id: tagihan_sama_pengirim ? pengirim_provinsi_id : tagihan_provinsi_id,
      tagihan_kabupaten_id: tagihan_sama_pengirim ? pengirim_kabupaten_id : tagihan_kabupaten_id,
      tagihan_kecamatan_id: tagihan_sama_pengirim ? pengirim_kecamatan_id : tagihan_kecamatan_id,
      tagihan_kelurahan_id: tagihan_sama_pengirim ? pengirim_kelurahan_id : tagihan_kelurahan_id,
      tagihan_detail: tagihan_sama_pengirim ? pengirim_detail : tagihan_detail,
      tagihan_kode_pos: tagihan_sama_pengirim ? (pengirim_kode_pos || null) : (tagihan_kode_pos || null),
      status: 'ACTIVE',
      is_test: req.user.role === 'TEST' ? 1 : 0,
      created_by: req.user.id,
    });

    const itemsData = items.map(item => ({
      penjualan_offline_id: penjualan.id,
      barang_id: item.barang_id,
      varian_nama: item.varian_nama || null,
      varian_id: item.varian_id || null,
      qty: item.qty,
      harga_satuan: item.harga_satuan,
      diskon: item.diskon || 0,
      subtotal: item.qty * item.harga_satuan * (1 - Math.max(0, item.diskon || 0) / 100),
    }));
    await PenjualanOfflineItem.bulkCreate(itemsData);

    await deductStok(itemsData, req.user.role === 'TEST');

    await logAction(req.user.id, 'BUAT_PENJUALAN_OFFLINE', `ID: ${penjualan.id}, Tipe: ${tipe}`, req.ip);
    emitDataUpdated('penjualan-offline-list', { updatedBy: req.user.id });

    return res.status(201).json({ id: penjualan.id, message: 'Penjualan berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/penjualan-offline
router.get('/', authenticate, async (req, res) => {
  try {
    const { tipe, faktur, status, search, from_display, page = 1, limit = 20 } = req.query;
    const where = { is_test: req.user.role === 'TEST' ? 1 : 0 };
    if (tipe) where.tipe = tipe;
    if (faktur) where.faktur = faktur;
    if (status) where.status = status;
    if (from_display === '1') where.display_source_id = { [Op.not]: null };
    if (search) {
      where[Op.or] = [
        { nama_penerima: { [Op.like]: `%${search}%` } },
        { no_hp_penerima: { [Op.like]: `%${search}%` } },
        { no_po: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await PenjualanOffline.findAndCountAll({
      where,
      include: [
        { model: PenjualanOfflineItem, as: 'items' },
        { model: SuratJalan, as: 'suratJalans', attributes: ['nomor_surat', 'tanggal'] },
        { model: Invoice, as: 'invoices', attributes: ['nomor_invoice', 'tanggal'] },
        { model: SuratPengantar, as: 'suratPengantars', attributes: ['nomor_sp', 'tanggal'] },
      ],
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

// GET /api/penjualan-offline/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id, { include: fullInclude });
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    return res.json(penjualan);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/penjualan-offline/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const {
      nama_penerima, no_hp_penerima, no_po, tanggal, nama_npwp, no_npwp,
      pengirim_provinsi_id, pengirim_kabupaten_id, pengirim_kecamatan_id, pengirim_kelurahan_id, pengirim_detail, pengirim_kode_pos,
      tagihan_sama_pengirim, tagihan_provinsi_id, tagihan_kabupaten_id, tagihan_kecamatan_id, tagihan_kelurahan_id, tagihan_detail, tagihan_kode_pos,
      items, status,
    } = req.body;

    await penjualan.update({
      nama_penerima, no_hp_penerima, no_po, tanggal, nama_npwp, no_npwp,
      pengirim_provinsi_id, pengirim_kabupaten_id, pengirim_kecamatan_id, pengirim_kelurahan_id, pengirim_detail,
      pengirim_kode_pos: pengirim_kode_pos || null,
      tagihan_sama_pengirim: tagihan_sama_pengirim ? 1 : 0,
      tagihan_provinsi_id: tagihan_sama_pengirim ? pengirim_provinsi_id : tagihan_provinsi_id,
      tagihan_kabupaten_id: tagihan_sama_pengirim ? pengirim_kabupaten_id : tagihan_kabupaten_id,
      tagihan_kecamatan_id: tagihan_sama_pengirim ? pengirim_kecamatan_id : tagihan_kecamatan_id,
      tagihan_kelurahan_id: tagihan_sama_pengirim ? pengirim_kelurahan_id : tagihan_kelurahan_id,
      tagihan_detail: tagihan_sama_pengirim ? pengirim_detail : tagihan_detail,
      tagihan_kode_pos: tagihan_sama_pengirim ? (pengirim_kode_pos || null) : (tagihan_kode_pos || null),
      status: status || penjualan.status,
    });

    if (items) {
      await PenjualanOfflineItem.destroy({ where: { penjualan_offline_id: penjualan.id } });
      const itemsData = items.map(item => ({
        penjualan_offline_id: penjualan.id,
        barang_id: item.barang_id,
        varian_nama: item.varian_nama || null,
        varian_id: item.varian_id || null,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        diskon: item.diskon || 0,
        subtotal: item.qty * item.harga_satuan * (1 - Math.max(0, item.diskon || 0) / 100),
      }));
      await PenjualanOfflineItem.bulkCreate(itemsData);
    }

    await logAction(req.user.id, 'UPDATE_PENJUALAN_OFFLINE', `ID: ${penjualan.id}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-offline-list', { updatedBy: req.user.id });
    return res.json({ message: 'Data berhasil diupdate' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/:id/surat-jalan
router.post('/:id/surat-jalan', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id, {
      include: [{ model: PenjualanOfflineItem, as: 'items' }],
    });
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (penjualan.tipe !== 'PENJUALAN') {
      return res.status(400).json({ message: 'Surat Jalan hanya untuk tipe PENJUALAN' });
    }

    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    const nomor_surat = await generateNomorSJ(penjualan.faktur, tanggal, penjualan.is_test === 1);

    const sj = await SuratJalan.create({
      penjualan_offline_id: penjualan.id,
      nomor_surat,
      tanggal,
      catatan: req.body.catatan || null,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_SURAT_JALAN', `Nomor: ${nomor_surat}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: sj.id, nomor_surat, message: 'Surat Jalan berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/:id/invoice
router.post('/:id/invoice', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (penjualan.tipe !== 'PENJUALAN') {
      return res.status(400).json({ message: 'Invoice hanya untuk tipe PENJUALAN' });
    }

    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    const nomor_invoice = await generateNomorInvoice(penjualan.faktur, tanggal, penjualan.is_test === 1);
    const ppn_persen = [0, 10, 11].includes(Number(req.body.ppn_persen)) ? Number(req.body.ppn_persen) : 0;
    const jatuh_tempo = new Date(new Date(tanggal).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const inv = await Invoice.create({
      penjualan_offline_id: penjualan.id,
      nomor_invoice,
      tanggal,
      jatuh_tempo,
      ppn_persen,
      catatan: req.body.catatan || null,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_INVOICE', `Nomor: ${nomor_invoice}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: inv.id, nomor_invoice, message: 'Invoice berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/:id/surat-pengantar
router.post('/:id/surat-pengantar', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (penjualan.tipe !== 'DISPLAY') {
      return res.status(400).json({ message: 'Surat Pengantar hanya untuk tipe DISPLAY' });
    }

    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    // DISPLAY tidak pakai prefix NF — selalu format FAKTUR (tanpa prefix)
    const fakturSP = penjualan.tipe === 'DISPLAY' ? 'FAKTUR' : penjualan.faktur;
    const nomor_sp = await generateNomorSP(fakturSP, tanggal, penjualan.is_test === 1);

    const sp = await SuratPengantar.create({
      penjualan_offline_id: penjualan.id,
      nomor_sp,
      tanggal,
      catatan: req.body.catatan || null,
      created_by: req.user.id,
    });

    await logAction(req.user.id, 'BUAT_SURAT_PENGANTAR', `Nomor: ${nomor_sp}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: sp.id, nomor_sp, message: 'Surat Pengantar berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/:id/proses-jual-item
router.post('/:id/proses-jual-item', authenticate, async (req, res) => {
  try {
    const { items, faktur, nama_npwp, no_npwp, tanggal } = req.body; // items: array dari { item_id, qty_jual, harga_jual, diskon }; faktur: 'FAKTUR'|'NON_FAKTUR'
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 item harus diisi untuk diproses.' });
    }

    const sequelize = require('../config/database');
    const t = await sequelize.transaction();

    try {
      const display = await PenjualanOffline.findByPk(req.params.id, { transaction: t });
      if (!display || display.tipe !== 'DISPLAY') {
        throw new Error('Data bukan transaksi DISPLAY yang valid.');
      }

      // Validasi semua items
      const validItemsToProcess = [];
      for (const reqItem of items) {
        const qtyJualInt = parseInt(reqItem.qty_jual, 10);
        if (!qtyJualInt || qtyJualInt <= 0) continue; // Abaikan jika qty 0

        const itemDisplay = await PenjualanOfflineItem.findOne({
          where: { id: reqItem.item_id, penjualan_offline_id: display.id },
          transaction: t,
        });

        if (!itemDisplay) {
          throw new Error(`Item ID ${reqItem.item_id} tidak ditemukan.`);
        }
        if (qtyJualInt > itemDisplay.qty) {
          throw new Error(`Qty jual melebihi qty display untuk item ID ${reqItem.item_id}.`);
        }

        validItemsToProcess.push({
          itemDisplay,
          qtyJualInt,
          harga_jual: reqItem.harga_jual,
          diskon: reqItem.diskon || 0
        });
      }

      if (validItemsToProcess.length === 0) {
        throw new Error('Tidak ada qty yang valid untuk diproses.');
      }

      // Create 1 new PenjualanOffline for all sold items
      const finalFaktur = faktur === 'FAKTUR' || faktur === 'NON_FAKTUR' ? faktur : display.faktur;
      const penjualanBaru = await PenjualanOffline.create({
        tipe: 'PENJUALAN',
        faktur: finalFaktur,
        nama_penerima: display.nama_penerima,
        no_hp_penerima: display.no_hp_penerima,
        no_po: display.no_po,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        nama_npwp: nama_npwp !== undefined ? nama_npwp : display.nama_npwp,
        no_npwp: no_npwp !== undefined ? no_npwp : display.no_npwp,
        pengirim_provinsi_id: display.pengirim_provinsi_id,
        pengirim_kabupaten_id: display.pengirim_kabupaten_id,
        pengirim_kecamatan_id: display.pengirim_kecamatan_id,
        pengirim_kelurahan_id: display.pengirim_kelurahan_id,
        pengirim_detail: display.pengirim_detail,
        tagihan_sama_pengirim: display.tagihan_sama_pengirim,
        tagihan_provinsi_id: display.tagihan_provinsi_id,
        tagihan_kabupaten_id: display.tagihan_kabupaten_id,
        tagihan_kecamatan_id: display.tagihan_kecamatan_id,
        tagihan_kelurahan_id: display.tagihan_kelurahan_id,
        tagihan_detail: display.tagihan_detail,
        status: 'ACTIVE',
        is_test: display.is_test,
        display_source_id: display.id,
        created_by: req.user.id,
      }, { transaction: t });

      // Proses setiap item
      for (const { itemDisplay, qtyJualInt, harga_jual } of validItemsToProcess) {
        // Untuk DISPLAY, harga_satuan IS the effective selling price (diskon di Display bersifat sintetis)
        const displayEffectivePrice = parseFloat(itemDisplay.harga_satuan);

        let finalHargaSatuan, finalDiskon;
        if (harga_jual !== undefined && harga_jual !== null && harga_jual !== '') {
          // User override: simpan harga_satuan display sebagai base, hitung diskon ke harga yg diinput
          const enteredHarga = parseFloat(harga_jual);
          finalHargaSatuan = displayEffectivePrice;
          finalDiskon = displayEffectivePrice > 0
            ? Math.max(0, Math.round((1 - enteredHarga / displayEffectivePrice) * 100))
            : 0;
        } else {
          // Tidak ada override: pakai harga display langsung, diskon 0
          finalHargaSatuan = displayEffectivePrice;
          finalDiskon = 0;
        }
        const subtotalM = finalHargaSatuan * qtyJualInt * (1 - finalDiskon / 100);

        // Create new item in PENJUALAN
        await PenjualanOfflineItem.create({
          penjualan_offline_id: penjualanBaru.id,
          barang_id: itemDisplay.barang_id,
          varian_nama: itemDisplay.varian_nama || null,
          varian_id: itemDisplay.varian_id || null,
          qty: qtyJualInt,
          harga_satuan: finalHargaSatuan,
          diskon: finalDiskon,
          subtotal: subtotalM,
        }, { transaction: t });

        // Update remaining display qty
        const sisakQty = itemDisplay.qty - qtyJualInt;
        const subtotalSisa = sisakQty > 0 ? displayEffectivePrice * sisakQty : 0;
        await itemDisplay.update({ qty: sisakQty > 0 ? sisakQty : 0, subtotal: subtotalSisa }, { transaction: t });
      }

      await t.commit();
      
      await logAction(req.user.id, 'PROSES_TERJUAL_DISPLAY', `Dari Display ID: ${display.id} ke Penjualan ID: ${penjualanBaru.id} (${validItemsToProcess.length} items)`, req.ip);
      emitDataUpdated(`penjualan-offline:${display.id}`, { updatedBy: req.user.id });

      return res.status(200).json({
        message: 'Berhasil memproses penjualan multi-item',
        new_penjualan_id: penjualanBaru.id
      });
    } catch (err) {
      await t.rollback();
      return res.status(400).json({ message: err.message });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/penjualan-offline/laku-dari-display/:display_id
router.get('/laku-dari-display/:display_id', authenticate, async (req, res) => {
  try {
    const rows = await PenjualanOffline.findAll({
      where: { display_source_id: req.params.display_id, is_test: req.user.role === 'TEST' ? 1 : 0 },
      include: [
        { model: PenjualanOfflineItem, as: 'items', include: [{ model: Barang, as: 'barang' }] },
        { model: SuratJalan, as: 'suratJalans', attributes: ['tanggal'], order: [['tanggal', 'ASC']] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/sp/:sp_id/sub-sp - buat sub-SP per item
router.post('/sp/:sp_id/sub-sp', authenticate, async (req, res) => {
  try {
    const sp = await SuratPengantar.findByPk(req.params.sp_id, {
      include: [{ model: PenjualanOffline, as: 'penjualan', include: [{ model: PenjualanOfflineItem, as: 'items' }] }],
    });
    if (!sp) return res.status(404).json({ message: 'Surat Pengantar tidak ditemukan' });

    const { item_ids } = req.body; // array of penjualan_offline_item_id
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ message: 'Pilih minimal 1 item' });
    }

    // Cek item mana yang sudah punya sub-SP (tidak boleh diubah)
    const existingSubs = await SuratPengantarSub.findAll({ where: { surat_pengantar_id: sp.id } });
    const existingItemIds = existingSubs.map(s => s.penjualan_offline_item_id);
    const newItemIds = item_ids.filter(id => !existingItemIds.includes(id));

    if (newItemIds.length === 0) {
      return res.status(400).json({ message: 'Semua item yang dipilih sudah memiliki sub-SP.' });
    }

    // Parse nomor SP utama: "0013/SP/04/2026" -> seq="0013", rest="SP/04/2026"
    const parts = sp.nomor_sp.split('/');
    const seq = parts[0];
    const rest = parts.slice(1).join('/');

    // Urutan lanjut dari yang sudah ada
    const startUrutan = existingSubs.length + 1;
    const newSubs = newItemIds.map((item_id, index) => ({
      surat_pengantar_id: sp.id,
      penjualan_offline_item_id: item_id,
      nomor_sp_sub: `${seq}/B${String(startUrutan + index).padStart(2, '0')}/${rest}`,
      urutan: startUrutan + index,
      created_by: req.user.id,
    }));

    await SuratPengantarSub.bulkCreate(newSubs);
    await logAction(req.user.id, 'BUAT_SUB_SP', `SP ID: ${sp.id}, +${newSubs.length} sub-SP`, req.ip);

    return res.status(201).json({ message: 'Sub-SP berhasil dibuat', count: newSubs.length });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/penjualan-offline/:id/identitas - edit identitas penerima
router.patch('/:id/identitas', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { nama_penerima, no_hp_penerima, no_po, nama_npwp, no_npwp } = req.body;

    const updates = {};
    if (nama_penerima !== undefined) updates.nama_penerima = nama_penerima;
    if (no_hp_penerima !== undefined) updates.no_hp_penerima = no_hp_penerima;
    if (no_po !== undefined) updates.no_po = no_po;
    if (nama_npwp !== undefined) updates.nama_npwp = nama_npwp;
    if (no_npwp !== undefined) updates.no_npwp = no_npwp;

    await penjualan.update(updates);
    const { logAction } = require('../middleware/logger');
    await logAction(req.user.id, 'EDIT_IDENTITAS_OFFLINE', `Edit identitas penjualan offline #${penjualan.id}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-offline-list', { updatedBy: req.user.id });

    return res.json({ message: 'Identitas berhasil diperbarui' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/penjualan-offline/:id/status — ubah status manual (admin only)
router.patch('/:id/status', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { status } = req.body;
    if (!['DRAFT', 'ACTIVE', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid. Gunakan DRAFT, ACTIVE, atau COMPLETED.' });
    }

    await penjualan.update({ status });
    const { logAction } = require('../middleware/logger');
    await logAction(req.user.id, 'UPDATE_STATUS_OFFLINE', `Status penjualan offline #${penjualan.id} → ${status}`, req.ip);
    emitDataUpdated(`penjualan-offline:${penjualan.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-offline-list', { updatedBy: req.user.id });

    return res.json({ message: 'Status berhasil diperbarui', status });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/penjualan-offline/items/:item_id/varian — edit varian item (koreksi salah input)
router.patch('/items/:item_id/varian', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  try {
    const item = await PenjualanOfflineItem.findByPk(req.params.item_id);
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });

    const { varian_nama, varian_id } = req.body;
    await item.update({
      varian_nama: varian_nama || null,
      varian_id: varian_id || null,
    });

    const { logAction } = require('../middleware/logger');
    await logAction(req.user.id, 'EDIT_VARIAN_ITEM', `Item #${item.id} varian → ${varian_nama || '-'}`, req.ip);
    emitDataUpdated(`penjualan-offline:${item.penjualan_offline_id}`, { updatedBy: req.user.id });

    return res.json({ message: 'Varian berhasil diperbarui' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/penjualan-offline/:id/retur
router.post('/:id/retur', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  const t = await sequelize.transaction();
  try {
    const penjualan = await PenjualanOffline.findByPk(req.params.id, {
      include: [
        { model: SuratJalan, as: 'suratJalans' },
        { model: SuratPengantar, as: 'suratPengantars' },
      ],
      transaction: t,
    });
    if (!penjualan) {
      await t.rollback();
      return res.status(404).json({ message: 'Penjualan tidak ditemukan' });
    }

    // Validasi: PENJUALAN harus ada SJ, DISPLAY harus ada SP
    if (penjualan.tipe === 'PENJUALAN' && (!penjualan.suratJalans || penjualan.suratJalans.length === 0)) {
      await t.rollback();
      return res.status(400).json({ message: 'Retur hanya bisa dilakukan setelah Surat Jalan dibuat' });
    }
    if (penjualan.tipe === 'DISPLAY' && (!penjualan.suratPengantars || penjualan.suratPengantars.length === 0)) {
      await t.rollback();
      return res.status(400).json({ message: 'Retur hanya bisa dilakukan setelah Surat Pengantar dibuat' });
    }

    const { surat_jalan_id, tanggal, catatan, items } = req.body;

    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 item retur wajib diisi' });
    }
    if (!tanggal) {
      await t.rollback();
      return res.status(400).json({ message: 'Tanggal retur wajib diisi' });
    }

    // Validasi surat_jalan_id jika PENJUALAN
    if (penjualan.tipe === 'PENJUALAN' && surat_jalan_id) {
      const sjValid = penjualan.suratJalans.some(sj => sj.id === surat_jalan_id);
      if (!sjValid) {
        await t.rollback();
        return res.status(400).json({ message: 'Surat Jalan tidak ditemukan atau bukan milik penjualan ini' });
      }
    }

    const returItems = [];
    for (const item of items) {
      const { penjualan_offline_item_id, qty_retur } = item;
      if (!qty_retur || qty_retur <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Qty retur harus lebih dari 0' });
      }

      const offlineItem = await PenjualanOfflineItem.findOne({
        where: { id: penjualan_offline_item_id, penjualan_offline_id: req.params.id },
        transaction: t,
      });
      if (!offlineItem) {
        await t.rollback();
        return res.status(400).json({ message: `Item #${penjualan_offline_item_id} tidak ditemukan pada penjualan ini` });
      }
      if (qty_retur > offlineItem.qty) {
        await t.rollback();
        return res.status(400).json({ message: `Qty retur melebihi qty pembelian (${offlineItem.qty})` });
      }

      await ReturOffline.create({
        penjualan_offline_id: req.params.id,
        surat_jalan_id: surat_jalan_id || null,
        penjualan_offline_item_id,
        qty_retur,
        tanggal,
        catatan: catatan || null,
        created_by: req.user.id,
      }, { transaction: t });

      returItems.push({ ...offlineItem.dataValues, qty_retur });
    }

    await t.commit();

    // Kembalikan stok setelah commit berhasil
    await restoreStok(returItems, req.user.role === 'TEST');

    await logAction(req.user.id, 'CATAT_RETUR_OFFLINE',
      `Retur Penjualan Offline #${req.params.id}, ${items.length} item`, req.ip);
    emitDataUpdated(`penjualan-offline:${req.params.id}`, { updatedBy: req.user.id });

    return res.status(201).json({ message: 'Retur berhasil dicatat' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
