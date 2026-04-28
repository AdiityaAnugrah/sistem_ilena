const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
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

// ── Nomor renumbering helpers ─────────────────────────────────────────────────

function parseNomor(s) {
  const m = s.match(/^((?:TEST-)?(?:NF)?)(\d+)(.*)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), padLen: m[2].length, suffix: m[3] };
}

function formatNomor(prefix, num, padLen, suffix) {
  return `${prefix}${String(num).padStart(padLen, '0')}${suffix}`;
}

// Renumber documents across multiple tables after nomors have been deleted.
// Groups deleted nomors by prefix+suffix so multi-month penjualan are handled correctly.
// counterTipeFn: (prefix) => DocumentCounter.tipe string
async function renumberType({ tables, deletedNomors, counterTipeFn, t }) {
  if (!deletedNomors.length) return;

  const groups = {};
  for (const n of deletedNomors) {
    const p = parseNomor(n);
    if (!p) continue;
    const key = `${p.prefix}||${p.suffix}`;
    if (!groups[key]) groups[key] = { prefix: p.prefix, padLen: p.padLen, suffix: p.suffix, nums: [] };
    groups[key].nums.push(p.num);
  }

  for (const g of Object.values(groups)) {
    const { prefix, padLen, suffix, nums } = g;
    const deletedNums = [...nums].sort((a, b) => a - b);
    const tahun = parseInt(suffix.split('/').pop(), 10);
    const counterTipe = counterTipeFn(prefix);

    for (const { model, field } of tables) {
      const docs = await model.findAll({
        where: { [field]: { [Op.like]: `%${suffix}` } },
        attributes: ['id', field],
        order: [[field, 'ASC']],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      for (const doc of docs) {
        const p = parseNomor(doc[field]);
        if (!p || p.prefix !== prefix || p.suffix !== suffix) continue;
        const decrement = deletedNums.filter(n => n <= p.num).length;
        if (!decrement) continue;
        await doc.update({ [field]: formatNomor(prefix, p.num - decrement, padLen, suffix) }, { transaction: t });
      }
    }

    const counter = await DocumentCounter.findOne({ where: { tipe: counterTipe, bulan: 0, tahun }, transaction: t });
    if (counter) {
      counter.last_number = Math.max(0, counter.last_number - nums.length);
      await counter.save({ transaction: t });
    }
  }
}

// Renumber SuratPengantar + cascade-update SuratPengantarSub nomors.
// SP sub format: {seq}/B{nn}/{rest} — when seq changes, subs must change too.
async function renumberSP({ deletedNomors, t }) {
  if (!deletedNomors.length) return;

  const groups = {};
  for (const n of deletedNomors) {
    const p = parseNomor(n);
    if (!p) continue;
    const key = `${p.prefix}||${p.suffix}`;
    if (!groups[key]) groups[key] = { prefix: p.prefix, padLen: p.padLen, suffix: p.suffix, nums: [] };
    groups[key].nums.push(p.num);
  }

  for (const g of Object.values(groups)) {
    const { prefix, padLen, suffix, nums } = g;
    const deletedNums = [...nums].sort((a, b) => a - b);
    const tahun = parseInt(suffix.split('/').pop(), 10);
    const counterTipe = prefix.startsWith('NF') ? 'SP_NON_FAKTUR' : 'SP_FAKTUR';

    const spDocs = await SuratPengantar.findAll({
      where: { nomor_sp: { [Op.like]: `%${suffix}` } },
      attributes: ['id', 'nomor_sp'],
      order: [['nomor_sp', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    for (const sp of spDocs) {
      const p = parseNomor(sp.nomor_sp);
      if (!p || p.prefix !== prefix || p.suffix !== suffix) continue;
      const decrement = deletedNums.filter(n => n <= p.num).length;
      if (!decrement) continue;
      const oldSeq = String(p.num).padStart(p.padLen, '0');
      const newSeq = String(p.num - decrement).padStart(p.padLen, '0');
      await sp.update({ nomor_sp: formatNomor(prefix, p.num - decrement, padLen, suffix) }, { transaction: t });
      // SP subs format: {seq}/B{nn}/{rest} — replace leading seq
      await SuratPengantarSub.update(
        { nomor_sp_sub: sequelize.literal(`REPLACE(\`nomor_sp_sub\`, '${oldSeq}/', '${newSeq}/')`) },
        { where: { surat_pengantar_id: sp.id }, transaction: t },
      );
    }

    const counter = await DocumentCounter.findOne({ where: { tipe: counterTipe, bulan: 0, tahun }, transaction: t });
    if (counter) {
      counter.last_number = Math.max(0, counter.last_number - nums.length);
      await counter.save({ transaction: t });
    }
  }
}

// GET /api/dev/penjualan-by-doc — cari penjualan by nomor dokumen (SJ/Invoice/SP/Proforma)
router.get('/penjualan-by-doc', authenticate, requireDev, async (req, res) => {
  const { sumber, nomor } = req.query;
  if (!nomor?.trim() || !['offline', 'interior'].includes(sumber)) {
    return res.status(400).json({ message: 'Parameter tidak valid' });
  }
  const q = nomor.trim();
  let penjualanId = null;

  if (sumber === 'offline') {
    const sj = await SuratJalan.findOne({ where: { nomor_surat: q } });
    if (sj) penjualanId = sj.penjualan_offline_id;

    if (!penjualanId) {
      const inv = await Invoice.findOne({ where: { nomor_invoice: q } });
      if (inv) penjualanId = inv.penjualan_offline_id;
    }

    if (!penjualanId) {
      const sp = await SuratPengantar.findOne({ where: { nomor_sp: q } });
      if (sp) penjualanId = sp.penjualan_offline_id;
    }
  } else {
    const sj = await SuratJalanInterior.findOne({ where: { nomor_surat: q } });
    if (sj) penjualanId = sj.penjualan_interior_id;

    if (!penjualanId) {
      const inv = await InvoiceInterior.findOne({ where: { nomor_invoice: q } });
      if (inv) {
        const sjInt = await SuratJalanInterior.findByPk(inv.surat_jalan_interior_id);
        if (sjInt) penjualanId = sjInt.penjualan_interior_id;
      }
    }

    if (!penjualanId) {
      const proforma = await ProformaInvoice.findOne({ where: { nomor_proforma: q } });
      if (proforma) penjualanId = proforma.penjualan_interior_id;
    }

    if (!penjualanId) {
      const sp = await SuratPengantarInterior.findOne({ where: { nomor_surat: q } });
      if (sp) penjualanId = sp.penjualan_interior_id;
    }
  }

  if (!penjualanId) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
  return res.json({ penjualan_id: penjualanId });
});

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
  const penjualan = await PenjualanOffline.findByPk(id, {
    include: [{ model: PenjualanOfflineItem, as: 'items' }],
    transaction: t,
  });

  // Jika ini PENJUALAN dari display, kembalikan qty ke item display asal
  if (penjualan && penjualan.display_source_id && penjualan.tipe === 'PENJUALAN') {
    for (const item of (penjualan.items || [])) {
      const displayItem = await PenjualanOfflineItem.findOne({
        where: {
          penjualan_offline_id: penjualan.display_source_id,
          barang_id: item.barang_id,
          varian_id: item.varian_id || null,
        },
        transaction: t,
      });
      if (displayItem) {
        const restoredQty = displayItem.qty + item.qty;
        const hargaSatuan = parseFloat(displayItem.harga_satuan) || 0;
        await displayItem.update({
          qty: restoredQty,
          subtotal: restoredQty * hargaSatuan,
        }, { transaction: t });
      }
    }
  }

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

// DELETE /api/dev/penjualan/:sumber/:id — hapus satu penjualan produksi + renumber dokumen berikutnya
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

      // Collect nomors before deletion
      const sjNomors = (await SuratJalan.findAll({ where: { penjualan_offline_id: id }, attributes: ['nomor_surat'], transaction: t })).map(r => r.nomor_surat);
      const invNomors = (await Invoice.findAll({ where: { penjualan_offline_id: id }, attributes: ['nomor_invoice'], transaction: t })).map(r => r.nomor_invoice);
      const spNomors = (await SuratPengantar.findAll({ where: { penjualan_offline_id: id }, attributes: ['nomor_sp'], transaction: t })).map(r => r.nomor_sp);

      await deleteOffline(id, t);

      await renumberType({
        tables: [{ model: SuratJalan, field: 'nomor_surat' }, { model: SuratJalanInterior, field: 'nomor_surat' }],
        deletedNomors: sjNomors,
        counterTipeFn: (prefix) => prefix.startsWith('NF') ? 'SJ_NON_FAKTUR' : 'SJ_FAKTUR',
        t,
      });
      await renumberType({
        tables: [{ model: Invoice, field: 'nomor_invoice' }, { model: InvoiceInterior, field: 'nomor_invoice' }],
        deletedNomors: invNomors,
        counterTipeFn: (prefix) => prefix.startsWith('NF') ? 'INV_NON_FAKTUR' : 'INV_FAKTUR',
        t,
      });
      await renumberSP({ deletedNomors: spNomors, t });

    } else {
      const penjualan = await PenjualanInterior.findByPk(id, { transaction: t });
      if (!penjualan) { await t.rollback(); return res.status(404).json({ message: 'Penjualan tidak ditemukan' }); }

      // Collect nomors before deletion
      const sjIntDocs = await SuratJalanInterior.findAll({ where: { penjualan_interior_id: id }, attributes: ['id', 'nomor_surat'], transaction: t });
      const sjIntIds = sjIntDocs.map(r => r.id);
      const sjNomors = sjIntDocs.map(r => r.nomor_surat);
      const invNomors = sjIntIds.length
        ? (await InvoiceInterior.findAll({ where: { surat_jalan_interior_id: sjIntIds }, attributes: ['nomor_invoice'], transaction: t })).map(r => r.nomor_invoice)
        : [];
      const proformaNomors = (await ProformaInvoice.findAll({ where: { penjualan_interior_id: id }, attributes: ['nomor_proforma'], transaction: t })).map(r => r.nomor_proforma);
      const spIntNomors = (await SuratPengantarInterior.findAll({ where: { penjualan_interior_id: id }, attributes: ['nomor_surat'], transaction: t })).map(r => r.nomor_surat);

      await deleteInterior(id, t);

      await renumberType({
        tables: [{ model: SuratJalan, field: 'nomor_surat' }, { model: SuratJalanInterior, field: 'nomor_surat' }],
        deletedNomors: sjNomors,
        counterTipeFn: (prefix) => prefix.startsWith('NF') ? 'SJ_NON_FAKTUR' : 'SJ_FAKTUR',
        t,
      });
      await renumberType({
        tables: [{ model: Invoice, field: 'nomor_invoice' }, { model: InvoiceInterior, field: 'nomor_invoice' }],
        deletedNomors: invNomors,
        counterTipeFn: (prefix) => prefix.startsWith('NF') ? 'INV_NON_FAKTUR' : 'INV_FAKTUR',
        t,
      });
      await renumberType({
        tables: [{ model: ProformaInvoice, field: 'nomor_proforma' }],
        deletedNomors: proformaNomors,
        counterTipeFn: () => 'PROFORMA',
        t,
      });
      await renumberType({
        tables: [{ model: SuratPengantarInterior, field: 'nomor_surat' }],
        deletedNomors: spIntNomors,
        counterTipeFn: () => 'SP_INT',
        t,
      });
    }

    await t.commit();
    await logAction(req.user.id, 'DEV_HAPUS_SATU_PENJUALAN',
      `Hapus penjualan ${sumber} #${id}, nomor dokumen disesuaikan`, req.ip);

    return res.json({ message: `Penjualan ${sumber} #${id} berhasil dihapus, nomor dokumen disesuaikan` });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: 'Gagal menghapus data', error: err.message });
  }
});

module.exports = router;
