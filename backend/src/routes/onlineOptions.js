const express = require('express');
const { Op } = require('sequelize');
const { OnlineOption } = require('../models');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();
const TYPES = ['PLATFORM', 'METODE_PEMBAYARAN'];
const DEFAULTS = {
  PLATFORM: ['SHOPEE', 'TOKOPEDIA', 'TIKTOK', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM'],
  METODE_PEMBAYARAN: ['MARKETPLACE', 'TRANSFER', 'COD', 'QRIS', 'EDC'],
};

const isTest = (req) => req.user.role === 'TEST' ? 1 : 0;
const normalize = (value) => String(value || '').trim().toUpperCase();

async function ensureDefaults(tipe, is_test, userId) {
  const count = await OnlineOption.count({ where: { tipe, is_test } });
  if (count > 0) return;
  await OnlineOption.bulkCreate(DEFAULTS[tipe].map(nama => ({ tipe, nama, is_test, active: 1, created_by: userId })), { ignoreDuplicates: true });
}

router.get('/', authenticate, async (req, res) => {
  try {
    const tipe = normalize(req.query.tipe);
    const where = { is_test: isTest(req) };
    if (tipe) {
      if (!TYPES.includes(tipe)) return res.status(400).json({ message: 'Tipe tidak valid' });
      where.tipe = tipe;
      await ensureDefaults(tipe, where.is_test, req.user.id);
    } else {
      await Promise.all(TYPES.map(t => ensureDefaults(t, where.is_test, req.user.id)));
    }
    if (req.query.active !== undefined) where.active = Number(req.query.active) ? 1 : 0;
    const rows = await OnlineOption.findAll({ where, order: [['tipe', 'ASC'], ['nama', 'ASC']] });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) return res.status(403).json({ message: 'Akses ditolak' });
  try {
    const tipe = normalize(req.body.tipe);
    const nama = normalize(req.body.nama);
    if (!TYPES.includes(tipe)) return res.status(400).json({ message: 'Tipe tidak valid' });
    if (!nama) return res.status(400).json({ message: 'Nama wajib diisi' });
    const [row, created] = await OnlineOption.findOrCreate({
      where: { tipe, nama, is_test: isTest(req) },
      defaults: { active: 1, created_by: req.user.id },
    });
    if (!created && row.active !== 1) await row.update({ active: 1 });
    await logAction(req.user.id, 'UPSERT_ONLINE_OPTION', `${tipe}: ${nama}`, req.ip);
    return res.status(created ? 201 : 200).json({ message: 'Data berhasil disimpan', data: row });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) return res.status(403).json({ message: 'Akses ditolak' });
  try {
    const row = await OnlineOption.findOne({ where: { id: req.params.id, is_test: isTest(req) } });
    if (!row) return res.status(404).json({ message: 'Data tidak ditemukan' });
    const updates = {};
    if (req.body.nama !== undefined) updates.nama = normalize(req.body.nama);
    if (req.body.active !== undefined) updates.active = req.body.active ? 1 : 0;
    await row.update(updates);
    await logAction(req.user.id, 'UPDATE_ONLINE_OPTION', `${row.tipe}: ${row.nama}`, req.ip);
    return res.json({ message: 'Data berhasil diupdate', data: row });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (!['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(req.user.role)) return res.status(403).json({ message: 'Akses ditolak' });
  try {
    const row = await OnlineOption.findOne({ where: { id: req.params.id, is_test: isTest(req) } });
    if (!row) return res.status(404).json({ message: 'Data tidak ditemukan' });
    await row.destroy();
    await logAction(req.user.id, 'DELETE_ONLINE_OPTION', `${row.tipe}: ${row.nama}`, req.ip);
    return res.json({ message: 'Data berhasil dihapus' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
