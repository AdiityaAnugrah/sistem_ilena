const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate, requireDev } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', [
  body('username').notEmpty().withMessage('Username wajib diisi'),
  body('password').notEmpty().withMessage('Password wajib diisi'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username, active: 1 } });
    if (!user) return res.status(401).json({ message: 'Username atau password salah' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Username atau password salah' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    await logAction(user.id, 'LOGIN', `Login berhasil`, req.ip);

    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/register (DEV only)
router.post('/register', authenticate, requireDev, [
  body('username').notEmpty().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['DEV', 'ADMIN']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed, role });

    await logAction(req.user.id, 'REGISTER_USER', `Buat user: ${username}`, req.ip);

    return res.status(201).json({ id: user.id, username, email, role });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Username atau email sudah digunakan' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const { id, username, nama_lengkap, email, role } = req.user;
  return res.json({ id, username, nama_lengkap, email, role });
});

// PATCH /api/auth/profile - update profil sendiri (semua role)
router.patch('/profile', authenticate, [
  body('nama_lengkap').optional().trim(),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('new_password').optional().isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { nama_lengkap, email, current_password, new_password } = req.body;
    const updates = {};

    if (nama_lengkap !== undefined) updates.nama_lengkap = nama_lengkap || null;
    if (email !== undefined) updates.email = email;

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ message: 'Password lama wajib diisi untuk mengganti password.' });
      }
      const valid = await bcrypt.compare(current_password, req.user.password);
      if (!valid) {
        return res.status(400).json({ message: 'Password lama salah.' });
      }
      updates.password = await bcrypt.hash(new_password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Tidak ada perubahan.' });
    }

    await req.user.update(updates);
    await logAction(req.user.id, 'UPDATE_PROFILE', 'Update profil sendiri', req.ip);

    return res.json({
      message: 'Profil berhasil diperbarui.',
      user: {
        id: req.user.id,
        username: req.user.username,
        nama_lengkap: req.user.nama_lengkap,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email sudah digunakan.' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/setup-password?token=xxx — validasi token setup
router.get('/setup-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token tidak ditemukan' });

  try {
    const user = await User.findOne({ where: { setup_token: token } });
    if (!user) return res.status(404).json({ message: 'Link tidak valid atau sudah kadaluarsa' });
    return res.json({ valid: true, username: user.username, nama_lengkap: user.nama_lengkap });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/setup-password — atur kata sandi pertama kali
router.post('/setup-password', [
  body('token').notEmpty().withMessage('Token wajib ada'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { token, password } = req.body;
    const user = await User.findOne({ where: { setup_token: token } });
    if (!user) return res.status(404).json({ message: 'Link tidak valid atau sudah kadaluarsa' });

    const hashed = await bcrypt.hash(password, 10);
    await user.update({ password: hashed, active: 1, setup_token: null });
    await logAction(user.id, 'SETUP_PASSWORD', 'Pengguna mengatur kata sandi pertama kali', req.ip);

    return res.json({ message: 'Kata sandi berhasil diatur. Silahkan login.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/print-token — token 5 menit khusus untuk buka URL print PDF
router.post('/print-token', authenticate, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, role: req.user.role, purpose: 'print' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );
  return res.json({ token });
});

module.exports = router;
