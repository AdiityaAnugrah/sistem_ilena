const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate, requireDevOrSuperAdmin } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');
const { sendAccountEmail } = require('../utils/mailer');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Roles yang bisa dikelola berdasarkan role caller
const getAllowedRoles = (callerRole) => {
  if (callerRole === 'DEV') return ['DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA', 'TEST'];
  return ['ADMIN', 'PENGGUNA'];
};

// GET /api/users - list semua user sesuai hak akses
router.get('/', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const allowedRoles = getAllowedRoles(req.user.role);
    const users = await User.findAll({
      where: { role: allowedRoles },
      attributes: ['id', 'username', 'nama_lengkap', 'email', 'role', 'active', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/users - buat user baru (tanpa password — link aktivasi dikirim ke email)
router.post('/', authenticate, requireDevOrSuperAdmin, [
  body('username').notEmpty().isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('role').notEmpty().withMessage('Role wajib diisi'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, nama_lengkap, email, role } = req.body;
    const allowedRoles = getAllowedRoles(req.user.role);

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Role tidak diizinkan' });
    }

    // Buat setup token dan password placeholder yang tidak bisa digunakan login
    const setupToken = crypto.randomBytes(32).toString('hex');
    const placeholderPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const user = await User.create({
      username,
      nama_lengkap: nama_lengkap || null,
      email,
      password: placeholderPassword,
      role,
      active: 0,
      setup_token: setupToken,
    });

    await logAction(req.user.id, 'CREATE_USER', `Buat user: ${username} (${role})`, req.ip);

    // Kirim email aktivasi (best-effort)
    try {
      await sendAccountEmail({
        to: email,
        username,
        namaLengkap: nama_lengkap || null,
        eventType: 'setup',
        setupLink: `${FRONTEND_URL}/auth/setup-kata-sandi?token=${setupToken}`,
        adminName: req.user.username,
      });
    } catch (mailErr) {
      console.error('[mailer] Gagal kirim email aktivasi:', mailErr.message);
    }

    return res.status(201).json({
      id: user.id, username, nama_lengkap: user.nama_lengkap, email, role,
      message: 'User berhasil dibuat. Link aktivasi telah dikirim ke email.',
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Username atau email sudah digunakan' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id - edit user (nama_lengkap, email, role, reset password opsional)
router.put('/:id', authenticate, requireDevOrSuperAdmin, [
  body('username').optional().isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('role').optional().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa mengedit user ini' });
    }

    const { username, nama_lengkap, email, password, role } = req.body;

    if (role && !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Role tidak diizinkan' });
    }

    // Catat perubahan untuk email notifikasi
    const changes = [];
    if (username !== undefined && username !== target.username) changes.push(`Username: <strong>${target.username}</strong> → <strong>${username}</strong>`);
    if (nama_lengkap !== undefined && nama_lengkap !== (target.nama_lengkap || '')) changes.push(`Nama Lengkap: <strong>${target.nama_lengkap || '-'}</strong> → <strong>${nama_lengkap || '-'}</strong>`);
    if (email !== undefined && email !== target.email) changes.push(`Email: <strong>${target.email}</strong> → <strong>${email}</strong>`);
    if (role !== undefined && role !== target.role) changes.push(`Role/Akses: <strong>${target.role}</strong> → <strong>${role}</strong>`);
    if (password) changes.push(`Kata sandi telah direset oleh administrator.`);

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (nama_lengkap !== undefined) updates.nama_lengkap = nama_lengkap;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (password) updates.password = await bcrypt.hash(password, 10);

    await target.update(updates);
    await logAction(req.user.id, 'UPDATE_USER', `Edit user: ${target.username}`, req.ip);

    // Kirim email notifikasi perubahan (best-effort)
    if (changes.length > 0) {
      try {
        await sendAccountEmail({
          to: email || target.email,
          username: username || target.username,
          namaLengkap: nama_lengkap !== undefined ? nama_lengkap : target.nama_lengkap,
          eventType: 'updated',
          adminName: req.user.username,
          changes,
        });
      } catch (mailErr) {
        console.error('[mailer] Gagal kirim email update akun:', mailErr.message);
      }
    }

    return res.json({ message: 'User berhasil diupdate' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Username atau email sudah digunakan' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/users/:id/toggle-active - aktifkan/nonaktifkan user
router.patch('/:id/toggle-active', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menonaktifkan akun sendiri' });
    }

    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa mengubah status user ini' });
    }

    const newActive = target.active ? 0 : 1;
    await target.update({ active: newActive });
    await logAction(req.user.id, 'TOGGLE_USER_ACTIVE',
      `${newActive ? 'Aktifkan' : 'Nonaktifkan'} user: ${target.username}`, req.ip);

    // Kirim email notifikasi status (best-effort)
    try {
      await sendAccountEmail({
        to: target.email,
        username: target.username,
        namaLengkap: target.nama_lengkap,
        eventType: newActive ? 'activated' : 'deactivated',
        adminName: req.user.username,
      });
    } catch (mailErr) {
      console.error('[mailer] Gagal kirim email toggle-active:', mailErr.message);
    }

    return res.json({ message: `User berhasil ${newActive ? 'diaktifkan' : 'dinonaktifkan'}`, active: newActive });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/users/:id - hapus permanen
router.delete('/:id', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
    }

    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa menghapus user ini' });
    }

    // Kirim email notifikasi sebelum hapus (best-effort)
    try {
      await sendAccountEmail({
        to: target.email,
        username: target.username,
        namaLengkap: target.nama_lengkap,
        eventType: 'deleted',
        adminName: req.user.username,
      });
    } catch (mailErr) {
      console.error('[mailer] Gagal kirim email hapus akun:', mailErr.message);
    }

    const username = target.username;
    await target.destroy();
    await logAction(req.user.id, 'DELETE_USER', `Hapus user: ${username}`, req.ip);

    return res.json({ message: 'User berhasil dihapus' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
