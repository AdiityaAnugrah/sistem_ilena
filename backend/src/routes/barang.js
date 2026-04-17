const express = require('express');
const { Op } = require('sequelize');
const { Barang } = require('../models');
const BarangTest = require('../models/BarangTest');
const { authenticate, requireDevOrSuperAdmin } = require('../middleware/auth');

const getModel = (req) => req.user?.role === 'TEST' ? BarangTest : Barang;

const router = express.Router();

// GET /api/barang
router.get('/', authenticate, async (req, res) => {
  try {
    const M = getModel(req);
    const { search, kategori, subkategori, active, page = 1, limit = 20 } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { nama: { [Op.like]: `%${search}%` } },
        { pencarian: { [Op.like]: `%${search}%` } },
        { id: { [Op.like]: `%${search}%` } },
      ];
    }
    if (kategori) where.kategori = kategori;
    if (subkategori) where.subkategori = subkategori;
    if (active !== undefined) where.active = active;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await M.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['nama', 'ASC']],
    });

    return res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    console.error('[GET /api/barang] Error:', err.message, err.sql || '');
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/barang/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const barang = await getModel(req).findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });
    return res.json(barang);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/barang
router.post('/', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const M = getModel(req);
    const {
      id, nama, kategori, subkategori, harga, rate, diskon,
      pakai_jadwal_diskon, diskon_mulai, diskon_selesai,
      varian, deskripsi, shopee, tokped, tiktok,
      ruang_tamu, ruang_keluarga, ruang_tidur, active,
    } = req.body;

    if (!id || !nama) return res.status(400).json({ message: 'ID dan Nama wajib diisi' });

    const existing = await M.findByPk(id);
    if (existing) return res.status(400).json({ message: `ID ${id} sudah digunakan` });

    const pencarian = [nama, kategori, subkategori].filter(Boolean).join(' ').toLowerCase();

    const barang = await M.create({
      id, nama,
      kategori: kategori || '',
      subkategori: subkategori || '',
      harga: harga || 0,
      rate: rate || 0,
      diskon: diskon || 0,
      pakai_jadwal_diskon: pakai_jadwal_diskon || 0,
      diskon_mulai: pakai_jadwal_diskon ? (diskon_mulai || null) : null,
      diskon_selesai: pakai_jadwal_diskon ? (diskon_selesai || null) : null,
      varian: JSON.stringify(varian || []),
      deskripsi: deskripsi ? JSON.stringify(deskripsi) : '{}',
      shopee: shopee || '',
      tokped: tokped || '',
      tiktok: tiktok || '',
      active: active !== undefined ? active : 1,
      pengunjung: 0,
      ruang_tamu: ruang_tamu || 0,
      ruang_keluarga: ruang_keluarga || 0,
      ruang_tidur: ruang_tidur || 0,
      pencarian,
      tgl_update: new Date(),
    });

    return res.status(201).json(barang);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/barang/:id
router.put('/:id', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const M = getModel(req);
    const barang = await M.findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });

    const {
      nama, kategori, subkategori, harga, rate, diskon,
      pakai_jadwal_diskon, diskon_mulai, diskon_selesai,
      varian, deskripsi, shopee, tokped, tiktok,
      ruang_tamu, ruang_keluarga, ruang_tidur, active,
    } = req.body;

    const pencarian = [nama || barang.nama, kategori || barang.kategori, subkategori || barang.subkategori]
      .filter(Boolean).join(' ').toLowerCase();

    const pakaiJadwal = pakai_jadwal_diskon !== undefined ? pakai_jadwal_diskon : barang.pakai_jadwal_diskon;

    await barang.update({
      nama,
      kategori: kategori ?? barang.kategori,
      subkategori: subkategori ?? barang.subkategori,
      harga: harga ?? barang.harga,
      rate: rate ?? barang.rate,
      diskon: diskon ?? barang.diskon,
      pakai_jadwal_diskon: pakaiJadwal,
      diskon_mulai: pakaiJadwal ? (diskon_mulai ?? barang.diskon_mulai) : null,
      diskon_selesai: pakaiJadwal ? (diskon_selesai ?? barang.diskon_selesai) : null,
      varian: varian !== undefined ? JSON.stringify(varian) : barang.varian,
      deskripsi: deskripsi !== undefined ? (deskripsi ? JSON.stringify(deskripsi) : '{}') : barang.deskripsi,
      shopee: shopee !== undefined ? (shopee || '') : barang.shopee,
      tokped: tokped !== undefined ? (tokped || '') : barang.tokped,
      tiktok: tiktok !== undefined ? (tiktok || '') : barang.tiktok,
      ruang_tamu: ruang_tamu !== undefined ? ruang_tamu : barang.ruang_tamu,
      ruang_keluarga: ruang_keluarga !== undefined ? ruang_keluarga : barang.ruang_keluarga,
      ruang_tidur: ruang_tidur !== undefined ? ruang_tidur : barang.ruang_tidur,
      active,
      pencarian,
      tgl_update: new Date(),
    });

    return res.json(barang);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/barang/:id/toggle-active
router.patch('/:id/toggle-active', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const barang = await getModel(req).findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });
    await barang.update({ active: barang.active ? 0 : 1 });
    return res.json({ active: barang.active });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
