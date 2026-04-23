const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireDev } = require('../middleware/auth');
const {
  sequelize,
  PenjualanOffline, PenjualanOfflineItem, SuratJalan, Invoice, SuratPengantar, SuratPengantarSub,
  PenjualanInterior, PenjualanInteriorItem, ProformaInvoice, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, InvoiceInterior, ReturSJInterior,
  SuratPengantarInterior, SuratPengantarInteriorItem, DocumentCounter, User,
} = require('../models');
const { logAction } = require('../middleware/logger');

const router = express.Router();

// DELETE /api/dev/reset-test-data — hapus semua data penjualan is_test=1
router.delete('/reset-test-data', authenticate, requireDev, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ── Offline test data ─────────────────────────────────────────────────────
    const offlineIds = (await PenjualanOffline.findAll({
      where: { is_test: 1 }, attributes: ['id'], transaction: t,
    })).map(r => r.id);

    if (offlineIds.length > 0) {
      const spIds = (await SuratPengantar.findAll({
        where: { penjualan_offline_id: offlineIds }, attributes: ['id'], transaction: t,
      })).map(r => r.id);

      if (spIds.length > 0) {
        await SuratPengantarSub.destroy({ where: { surat_pengantar_id: spIds }, transaction: t });
        await SuratPengantar.destroy({ where: { id: spIds }, transaction: t });
      }

      await Invoice.destroy({ where: { penjualan_offline_id: offlineIds }, transaction: t });
      await SuratJalan.destroy({ where: { penjualan_offline_id: offlineIds }, transaction: t });
      await PenjualanOfflineItem.destroy({ where: { penjualan_offline_id: offlineIds }, transaction: t });
      await PenjualanOffline.destroy({ where: { id: offlineIds }, transaction: t });
    }

    // ── Interior test data ────────────────────────────────────────────────────
    const interiorIds = (await PenjualanInterior.findAll({
      where: { is_test: 1 }, attributes: ['id'], transaction: t,
    })).map(r => r.id);

    if (interiorIds.length > 0) {
      const sjIntIds = (await SuratJalanInterior.findAll({
        where: { penjualan_interior_id: interiorIds }, attributes: ['id'], transaction: t,
      })).map(r => r.id);

      // SP/INT dihapus sebelum SuratJalanInterior karena ada FK surat_jalan_interior_id
      const spIntIds = (await SuratPengantarInterior.findAll({
        where: { penjualan_interior_id: interiorIds }, attributes: ['id'], transaction: t,
      })).map(r => r.id);
      if (spIntIds.length > 0) {
        await SuratPengantarInteriorItem.destroy({ where: { surat_pengantar_interior_id: spIntIds }, transaction: t });
        await SuratPengantarInterior.destroy({ where: { id: spIntIds }, transaction: t });
      }

      if (sjIntIds.length > 0) {
        await ReturSJInterior.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
        await InvoiceInterior.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
        await SuratJalanInteriorItem.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
        await SuratJalanInterior.destroy({ where: { id: sjIntIds }, transaction: t });
      }

      await PembayaranInterior.destroy({ where: { penjualan_interior_id: interiorIds }, transaction: t });
      await ProformaInvoice.destroy({ where: { penjualan_interior_id: interiorIds }, transaction: t });
      await PenjualanInteriorItem.destroy({ where: { penjualan_interior_id: interiorIds }, transaction: t });
      await PenjualanInterior.destroy({ where: { id: interiorIds }, transaction: t });
    }

    await t.commit();

    await logAction(req.user.id, 'DEV_RESET_TEST_DATA',
      `Hapus ${offlineIds.length} penjualan offline + ${interiorIds.length} penjualan interior (is_test=1)`,
      req.ip);

    return res.json({
      message: 'Semua data testing berhasil dihapus',
      deleted: { offline: offlineIds.length, interior: interiorIds.length },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Gagal menghapus data', error: err.message });
  }
});

// ── Helper: hapus satu penjualan offline beserta semua dokumennya ─────────────
async function deleteOffline(id, t) {
  const spIds = (await SuratPengantar.findAll({ where: { penjualan_offline_id: id }, attributes: ['id'], transaction: t })).map(r => r.id);
  if (spIds.length > 0) {
    await SuratPengantarSub.destroy({ where: { surat_pengantar_id: spIds }, transaction: t });
    await SuratPengantar.destroy({ where: { id: spIds }, transaction: t });
  }
  await Invoice.destroy({ where: { penjualan_offline_id: id }, transaction: t });
  await SuratJalan.destroy({ where: { penjualan_offline_id: id }, transaction: t });
  await PenjualanOfflineItem.destroy({ where: { penjualan_offline_id: id }, transaction: t });
  await PenjualanOffline.destroy({ where: { id }, transaction: t });
}

// ── Helper: hapus satu penjualan interior beserta semua dokumennya ────────────
async function deleteInterior(id, t) {
  const sjIntIds = (await SuratJalanInterior.findAll({ where: { penjualan_interior_id: id }, attributes: ['id'], transaction: t })).map(r => r.id);
  const spIntIds = (await SuratPengantarInterior.findAll({ where: { penjualan_interior_id: id }, attributes: ['id'], transaction: t })).map(r => r.id);
  if (spIntIds.length > 0) {
    await SuratPengantarInteriorItem.destroy({ where: { surat_pengantar_interior_id: spIntIds }, transaction: t });
    await SuratPengantarInterior.destroy({ where: { id: spIntIds }, transaction: t });
  }
  if (sjIntIds.length > 0) {
    await ReturSJInterior.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
    await InvoiceInterior.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
    await SuratJalanInteriorItem.destroy({ where: { surat_jalan_interior_id: sjIntIds }, transaction: t });
    await SuratJalanInterior.destroy({ where: { id: sjIntIds }, transaction: t });
  }
  await PembayaranInterior.destroy({ where: { penjualan_interior_id: id }, transaction: t });
  await ProformaInvoice.destroy({ where: { penjualan_interior_id: id }, transaction: t });
  await PenjualanInteriorItem.destroy({ where: { penjualan_interior_id: id }, transaction: t });
  await PenjualanInterior.destroy({ where: { id }, transaction: t });
}

// DELETE /api/dev/penjualan-produksi — hapus SEMUA data produksi + reset counter
router.delete('/penjualan-produksi', authenticate, requireDev, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password wajib diisi' });

  const user = await User.findByPk(req.user.id);
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(403).json({ message: 'Password salah' });

  const t = await sequelize.transaction();
  try {
    const offlineIds = (await PenjualanOffline.findAll({ where: { is_test: 0 }, attributes: ['id'], transaction: t })).map(r => r.id);
    const interiorIds = (await PenjualanInterior.findAll({ where: { is_test: 0 }, attributes: ['id'], transaction: t })).map(r => r.id);

    for (const id of offlineIds) await deleteOffline(id, t);
    for (const id of interiorIds) await deleteInterior(id, t);

    // Reset semua counter dokumen (bukan test) ke 0
    await DocumentCounter.update({ last_number: 0 }, {
      where: sequelize.literal("tipe NOT LIKE 'TEST_%'"),
      transaction: t,
    });

    await t.commit();
    await logAction(req.user.id, 'DEV_HAPUS_PRODUKSI',
      `HAPUS SEMUA: ${offlineIds.length} offline + ${interiorIds.length} interior, counter direset`, req.ip);

    return res.json({ message: 'Semua data produksi berhasil dihapus', deleted: { offline: offlineIds.length, interior: interiorIds.length } });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Gagal menghapus data', error: err.message });
  }
});

// DELETE /api/dev/penjualan/:sumber/:id — hapus satu penjualan produksi
router.delete('/penjualan/:sumber/:id', authenticate, requireDev, async (req, res) => {
  const { sumber, id } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password wajib diisi' });
  if (!['offline', 'interior'].includes(sumber)) return res.status(400).json({ message: 'Sumber tidak valid' });

  const user = await User.findByPk(req.user.id);
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(403).json({ message: 'Password salah' });

  const t = await sequelize.transaction();
  try {
    if (sumber === 'offline') {
      const penjualan = await PenjualanOffline.findByPk(id, { transaction: t });
      if (!penjualan) { await t.rollback(); return res.status(404).json({ message: 'Penjualan tidak ditemukan' }); }
      await deleteOffline(id, t);
    } else {
      const penjualan = await PenjualanInterior.findByPk(id, { transaction: t });
      if (!penjualan) { await t.rollback(); return res.status(404).json({ message: 'Penjualan tidak ditemukan' }); }
      await deleteInterior(id, t);
    }

    await t.commit();
    await logAction(req.user.id, 'DEV_HAPUS_SATU_PENJUALAN',
      `Hapus penjualan ${sumber} #${id}`, req.ip);

    return res.json({ message: `Penjualan ${sumber} #${id} berhasil dihapus` });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Gagal menghapus data', error: err.message });
  }
});

module.exports = router;
