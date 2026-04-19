const express = require('express');
const { authenticate, requireDev } = require('../middleware/auth');
const {
  sequelize,
  PenjualanOffline, PenjualanOfflineItem, SuratJalan, Invoice, SuratPengantar, SuratPengantarSub,
  PenjualanInterior, PenjualanInteriorItem, ProformaInvoice, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, InvoiceInterior, ReturSJInterior,
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

module.exports = router;
