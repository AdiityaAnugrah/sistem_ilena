const jwt = require('jsonwebtoken');
const { User } = require('../models');

const sendPrintAuthError = (res, message, status = 401) => {
  res.status(status).type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cetak Ulang</title></head>
<body style="font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#334155">
  <div style="text-align:center;padding:24px"><h2 style="color:#b91c1c">Sesi cetak berakhir</h2><p>${message}. Silakan cetak ulang dari aplikasi.</p><button onclick="window.close()" style="border:0;border-radius:8px;background:#dc2626;color:white;padding:10px 18px;cursor:pointer">Kembali ke aplikasi</button></div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'ILENA_PRINT_TOKEN_EXPIRED' }, '*');
      setTimeout(function () { window.close(); }, 500);
    }
  </script>
</body></html>`);
};

const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ where: { id: decoded.id, active: 1 } });
    if (!user) {
      return res.status(401).json({ message: 'User tidak valid' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluarsa' });
  }
};

// Khusus untuk route print PDF — hanya menerima short-lived print token via ?token=
const authenticatePrint = async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return sendPrintAuthError(res, 'Print token tidak ditemukan');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'print') {
      return sendPrintAuthError(res, 'Token tidak valid untuk akses print', 403);
    }

    const user = await User.findOne({ where: { id: decoded.id, active: 1 } });
    if (!user) {
      return sendPrintAuthError(res, 'User tidak valid');
    }

    req.user = user;
    next();
  } catch (err) {
    return sendPrintAuthError(res, 'Print token tidak valid atau sudah kedaluwarsa');
  }
};

const requireDev = (req, res, next) => {
  if (req.user.role !== 'DEV') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya DEV yang diizinkan.' });
  }
  next();
};

const requireDevOrSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'DEV' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya DEV atau SUPER_ADMIN yang diizinkan.' });
  }
  next();
};

const requireAdminOrAbove = (req, res, next) => {
  const allowed = ['DEV', 'SUPER_ADMIN', 'ADMIN'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak. Hanya Admin atau di atasnya yang diizinkan.' });
  }
  next();
};

// Blokir akun TEST dari semua operasi mutasi (POST, PUT, PATCH, DELETE)
// Gunakan middleware ini di route master data atau route lain yang shared
const blockTestMutation = (req, res, next) => {
  if (req.user.role === 'TEST' && req.method !== 'GET') {
    return res.status(403).json({ message: 'Akun testing tidak dapat mengubah data master.' });
  }
  next();
};

module.exports = { authenticate, authenticatePrint, requireDev, requireDevOrSuperAdmin, requireAdminOrAbove, blockTestMutation };
