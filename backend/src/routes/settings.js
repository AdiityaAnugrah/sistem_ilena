const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SIGNATURE_PATH = path.join(UPLOADS_DIR, 'signature.png');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, 'signature.png'),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diizinkan'));
    }
    cb(null, true);
  },
});

// POST /api/settings/signature — upload tanda tangan
router.post('/signature', authenticate, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File tanda tangan wajib diupload' });
    }
    await logAction(req.user.id, 'UPLOAD_SIGNATURE', 'Upload tanda tangan sistem', req.ip);
    return res.json({ message: 'Tanda tangan berhasil disimpan' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/settings/signature — ambil tanda tangan
router.get('/signature', authenticate, (req, res) => {
  if (!fs.existsSync(SIGNATURE_PATH)) {
    return res.status(404).json({ message: 'Tanda tangan belum diupload' });
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SIGNATURE_PATH);
});

module.exports = router;
