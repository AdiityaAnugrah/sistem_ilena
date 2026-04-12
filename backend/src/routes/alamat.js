const express = require('express');
const { Provinsi, Kabupaten, Kecamatan, Kelurahan } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/provinsi', authenticate, async (req, res) => {
  try {
    const data = await Provinsi.findAll({ order: [['label', 'ASC']] });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/kabupaten/:provinsiId', authenticate, async (req, res) => {
  try {
    const data = await Kabupaten.findAll({
      where: { provinsi_id: req.params.provinsiId },
      order: [['label', 'ASC']],
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/kecamatan/:kabupatenId', authenticate, async (req, res) => {
  try {
    const data = await Kecamatan.findAll({
      where: { kabupaten_id: req.params.kabupatenId },
      order: [['label', 'ASC']],
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/kelurahan/:kecamatanId', authenticate, async (req, res) => {
  try {
    const data = await Kelurahan.findAll({
      where: { kecamatan_id: req.params.kecamatanId },
      order: [['label', 'ASC']],
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
