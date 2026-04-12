const express = require('express');
const { Op } = require('sequelize');
const { LogActivity, User } = require('../models');
const { authenticate, requireDev } = require('../middleware/auth');

const router = express.Router();

// GET /api/log-activity (DEV only)
router.get('/', authenticate, requireDev, async (req, res) => {
  try {
    const { user_id, action, from, to, page = 1, limit = 50 } = req.query;
    const where = {};

    if (user_id) where.user_id = user_id;
    if (action) where.action = { [Op.like]: `%${action}%` };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to + 'T23:59:59');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await LogActivity.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'role'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
