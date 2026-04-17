const express = require('express');
const TutorialVideo = require('../models/TutorialVideo');
const { authenticate, requireDev } = require('../middleware/auth');

const router = express.Router();

// GET /api/tutorial-video
router.get('/', async (req, res) => {
  try {
    const rows = await TutorialVideo.findAll();
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/tutorial-video/:form_type
router.get('/:form_type', async (req, res) => {
  try {
    const row = await TutorialVideo.findOne({ where: { form_type: req.params.form_type } });
    if (!row) return res.status(404).json({ message: 'Tidak ditemukan' });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/tutorial-video/:form_type — upsert, DEV only
router.put('/:form_type', authenticate, requireDev, async (req, res) => {
  try {
    const { youtube_url, start_second, end_second, active } = req.body;
    const { form_type } = req.params;

    if (!['PENJUALAN_OFFLINE', 'PENJUALAN_INTERIOR'].includes(form_type)) {
      return res.status(400).json({ message: 'form_type tidak valid' });
    }
    if (!youtube_url) return res.status(400).json({ message: 'youtube_url wajib diisi' });

    const [row, created] = await TutorialVideo.findOrCreate({
      where: { form_type },
      defaults: {
        youtube_url,
        start_second: start_second || 0,
        end_second: end_second || null,
        active: 1,
        updated_by: req.user.id,
      },
    });

    if (!created) {
      await row.update({
        youtube_url,
        start_second: start_second || 0,
        end_second: end_second || null,
        active: active !== undefined ? active : row.active,
        updated_by: req.user.id,
      });
    }

    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
