const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    // Support token via Authorization header OR ?token= query param (for window.open PDF print)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
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

module.exports = { authenticate, requireDev, requireDevOrSuperAdmin };
