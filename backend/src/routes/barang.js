const express = require('express');
const { Op } = require('sequelize');
const { Barang } = require('../models');
const { authenticate, requireDevOrSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/barang
router.get('/', authenticate, async (req, res) => {
  try {
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
    const { count, rows } = await Barang.findAndCountAll({
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
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/barang/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const barang = await Barang.findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });
    return res.json(barang);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/barang
router.post('/', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const {
      id, nama, kategori, subkategori, harga, diskon,
      varian, deskripsi, shopee, tokped, tiktok, active,
    } = req.body;

    if (!id || !nama) return res.status(400).json({ message: 'ID dan Nama wajib diisi' });

    const existing = await Barang.findByPk(id);
    if (existing) return res.status(400).json({ message: `ID ${id} sudah digunakan` });

    const pencarian = [nama, kategori, subkategori].filter(Boolean).join(' ').toLowerCase();

    const barang = await Barang.create({
      id, nama, kategori, subkategori,
      harga: harga || 0,
      diskon: diskon || 0,
      varian: varian ? JSON.stringify(varian) : null,
      deskripsi: deskripsi ? JSON.stringify(deskripsi) : null,
      shopee, tokped, tiktok,
      active: active !== undefined ? active : 1,
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
    const barang = await Barang.findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });

    const {
      nama, kategori, subkategori, harga, diskon,
      varian, deskripsi, shopee, tokped, tiktok, active,
    } = req.body;

    const pencarian = [nama || barang.nama, kategori || barang.kategori, subkategori || barang.subkategori]
      .filter(Boolean).join(' ').toLowerCase();

    await barang.update({
      nama, kategori, subkategori,
      harga, diskon,
      varian: varian !== undefined ? JSON.stringify(varian) : barang.varian,
      deskripsi: deskripsi !== undefined ? JSON.stringify(deskripsi) : barang.deskripsi,
      shopee, tokped, tiktok,
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
    const barang = await Barang.findByPk(req.params.id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });
    await barang.update({ active: barang.active ? 0 : 1 });
    return res.json({ active: barang.active });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
