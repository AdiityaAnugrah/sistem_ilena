const jwt = require('jsonwebtoken');
const { User } = require('../models');

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
      return res.status(401).json({ message: 'Print token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'print') {
      return res.status(403).json({ message: 'Token tidak valid untuk akses print' });
    }

    const user = await User.findOne({ where: { id: decoded.id, active: 1 } });
    if (!user) {
      return res.status(401).json({ message: 'User tidak valid' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Print token tidak valid atau sudah kadaluarsa' });
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
