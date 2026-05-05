const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authenticatePrint, blockTestMutation } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SIGS_DIR = path.join(UPLOADS_DIR, 'signatures');
const LEGACY_SIG = path.join(UPLOADS_DIR, 'signature.png');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SIGS_DIR)) fs.mkdirSync(SIGS_DIR, { recursive: true });

// Migrate legacy signature.png → signatures/sig_legacy.png (once)
if (fs.existsSync(LEGACY_SIG)) {
  const dest = path.join(SIGS_DIR, 'sig_legacy.png');
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(LEGACY_SIG, dest);
  }
}

const isValidFilename = (name) => name && !name.includes('..') && !name.includes('/') && !name.includes('\\');

// ─── Single signature (backward compat) ──────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, 'signature.png'),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Hanya file gambar yang diizinkan'));
    cb(null, true);
  },
});

// POST /api/settings/signature — legacy upload (overwrites)
router.post('/signature', authenticate, blockTestMutation, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tanda tangan wajib diupload' });
    await logAction(req.user.id, 'UPLOAD_SIGNATURE', 'Upload tanda tangan sistem', req.ip);
    return res.json({ message: 'Tanda tangan berhasil disimpan' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/settings/signature — legacy get
router.get('/signature', authenticate, (req, res) => {
  if (!fs.existsSync(LEGACY_SIG)) {
    return res.status(404).json({ message: 'Tanda tangan belum diupload' });
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(LEGACY_SIG);
});

// ─── Multi-signature ──────────────────────────────────────────────────────────

const multiStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SIGS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `sig_${Date.now()}${ext}`);
  },
});

const uploadMulti = multer({
  storage: multiStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Hanya file gambar yang diizinkan'));
    cb(null, true);
  },
});

// GET /api/settings/signatures — list all signatures
router.get('/signatures', authenticate, (req, res) => {
  const files = fs.existsSync(SIGS_DIR)
    ? fs.readdirSync(SIGS_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    : [];
  const list = files.map(f => ({
    id: f,
    url: `/settings/signatures/${encodeURIComponent(f)}`,
    createdAt: fs.statSync(path.join(SIGS_DIR, f)).mtime.toISOString(),
  }));
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// GET /api/settings/signatures/:id — serve one signature file (accepts both Bearer token and print token)
router.get('/signatures/:id', (req, res, next) => {
  // Support both: Bearer token (axios dari modal) dan print token (?token= dari iframe)
  if (req.query.token) return authenticatePrint(req, res, next);
  return authenticate(req, res, next);
}, (req, res) => {
  const filename = decodeURIComponent(req.params.id);
  if (!isValidFilename(filename)) return res.status(400).json({ message: 'Nama file tidak valid' });
  const filepath = path.join(SIGS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'Tidak ditemukan' });
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(filepath);
});

// POST /api/settings/signatures — upload new signature
router.post('/signatures', authenticate, blockTestMutation, uploadMulti.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tanda tangan wajib diupload' });
    await logAction(req.user.id, 'UPLOAD_SIGNATURE', `Upload tanda tangan: ${req.file.filename}`, req.ip);
    return res.json({
      message: 'Tanda tangan berhasil disimpan',
      id: req.file.filename,
      url: `/settings/signatures/${encodeURIComponent(req.file.filename)}`,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/settings/signatures/:id — delete a signature
router.delete('/signatures/:id', authenticate, blockTestMutation, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.id);
    if (!isValidFilename(filename)) return res.status(400).json({ message: 'Nama file tidak valid' });
    const filepath = path.join(SIGS_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'Tidak ditemukan' });
    fs.unlinkSync(filepath);
    await logAction(req.user.id, 'DELETE_SIGNATURE', `Hapus tanda tangan: ${filename}`, req.ip);
    return res.json({ message: 'Tanda tangan berhasil dihapus' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── App Settings (key-value) ─────────────────────────────────────────────────

const { AppSetting } = require('../models');

// GET /api/settings/app — return all app settings as { key: value }
router.get('/app', authenticate, async (req, res) => {
  try {
    const rows = await AppSetting.findAll();
    const result = {};
    rows.forEach(r => { result[r.key] = r.value; });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/settings/app — upsert one setting { key, value } (DEV only)
router.put('/app', authenticate, async (req, res) => {
  if (req.user.role !== 'DEV') {
    return res.status(403).json({ message: 'Hanya role DEV yang bisa mengubah pengaturan ini.' });
  }
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: 'Key wajib diisi' });

    await AppSetting.upsert({ key, value: String(value) });
    await logAction(req.user.id, 'UPDATE_APP_SETTING', `${key} = ${value}`, req.ip);
    return res.json({ message: 'Pengaturan berhasil disimpan', key, value: String(value) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
