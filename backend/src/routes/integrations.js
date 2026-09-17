const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize,
  Barang,
  PenjualanOnline,
  PenjualanOnlineItem,
  PembayaranOnline,
  ReturOnline,
  SuratJalanOnline,
  InvoiceOnline,
} = require('../models');
const BarangTest = require('../models/BarangTest');
const { logAction } = require('../middleware/logger');
const { emitDataUpdated } = require('../socket');

const router = express.Router();

const TEST_EMAILS = [
  'galihsuks123@gmail.com',
  'ilenafurniture@gmail.com',
  'galih8.4.2001@gmail.com',
  'adityaanugrah494@gmail.com',
  'tipaun0605@gmail.com',
  'uuua5021@gmail.com',
];

const money = (value) => Math.round(Number(value || 0));
const clean = (value, fallback = '') => {
  const text = String(value || '').trim();
  return text || fallback;
};

function parseMapEnv() {
  try {
    const parsed = JSON.parse(process.env.ILENA_WEB_PRODUCT_MAP || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractVariantName(item) {
  const explicit = clean(item.varian_nama || item.variant_name || item.varian || '');
  if (explicit) return explicit;
  const name = clean(item.name || item.nama || '');
  const match = name.match(/\(([^()]*)\)\s*$/);
  return match ? clean(match[1]) : null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .filter((item) => {
      const name = clean(item.name || item.nama || '').toLowerCase();
      const id = clean(item.id || item.barang_id || '').toLowerCase();
      return !['voucher', 'flash sale', 'biaya admin', 'biaya ongkir'].includes(name)
        && !['voucher', 'flash sale', 'biaya admin', 'biaya ongkir'].includes(id);
    })
    .map((item) => {
      const qty = Math.max(1, Number(item.quantity || item.qty || 1));
      const price = money(item.price ?? item.harga_satuan ?? item.harga ?? 0);
      return {
        website_id: clean(item.id || item.barang_id || item.sku || ''),
        name: clean(item.name || item.nama || item.product_name || 'Produk Website'),
        qty,
        price,
        subtotal: money(qty * price),
        varian_nama: extractVariantName(item),
        varian_id: item.varian_id ? String(item.varian_id) : null,
      };
    })
    .filter((item) => item.qty > 0 && item.price >= 0);
}

async function findBarang(item, isTest) {
  const map = parseMapEnv();
  const mappedId = map[item.website_id] || map[item.name];
  const BarangModel = isTest ? BarangTest : Barang;

  if (mappedId) {
    const mapped = await BarangModel.findByPk(mappedId);
    if (mapped) return mapped;
  }

  if (item.website_id) {
    const byId = await BarangModel.findByPk(item.website_id);
    if (byId) return byId;
  }

  const byName = await BarangModel.findOne({
    where: { nama: { [Op.like]: `%${item.name.replace(/\([^()]*\)\s*$/, '').trim()}%` } },
  });
  return byName || null;
}

async function resolveItemRows(items, isTest) {
  const rows = [];
  for (const item of items) {
    const barang = await findBarang(item, isTest);
    let varianId = item.varian_id;
    let varianNama = item.varian_nama;

    if (barang && barang.varian) {
      let varians = [];
      try { varians = JSON.parse(barang.varian); } catch { varians = []; }
      if (Array.isArray(varians) && varians.length > 0) {
        const match = varianNama
          ? varians.find((v) => String(v.nama || '').toLowerCase() === String(varianNama).toLowerCase())
          : null;
        const selected = match || varians[0];
        varianId = varianId || (selected.id != null ? String(selected.id) : null);
        varianNama = varianNama || selected.nama || null;
      }
    }

    rows.push({
      barang_id: barang?.id || item.website_id || 'WEBSITE-ITEM',
      varian_nama: varianNama || null,
      varian_id: varianId || null,
      qty: item.qty,
      harga_satuan: item.price,
      diskon: 0,
      subtotal: item.subtotal,
      _matched: Boolean(barang),
    });
  }
  return rows;
}

function normalizeWebsiteStatus(status) {
  const raw = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map = {
    proses: 'PEMBAYARAN_BERHASIL',
    diproses: 'PEMBAYARAN_BERHASIL',
    paid: 'PEMBAYARAN_BERHASIL',
    settlement: 'PEMBAYARAN_BERHASIL',
    capture: 'PEMBAYARAN_BERHASIL',
    success: 'PEMBAYARAN_BERHASIL',
    sukses: 'PEMBAYARAN_BERHASIL',
    menunggu_pembayaran: 'MENUNGGU_PEMBAYARAN',
    pending: 'MENUNGGU_PEMBAYARAN',
    waiting_payment: 'MENUNGGU_PEMBAYARAN',
    unpaid: 'MENUNGGU_PEMBAYARAN',
    batal: 'DIBATALKAN',
    dibatalkan: 'DIBATALKAN',
    cancel: 'DIBATALKAN',
    canceled: 'DIBATALKAN',
    cancelled: 'DIBATALKAN',
    expire: 'DIBATALKAN',
    expired: 'DIBATALKAN',
    deny: 'DIBATALKAN',
    denied: 'DIBATALKAN',
    failure: 'DIBATALKAN',
    failed: 'DIBATALKAN',
    gagal: 'DIBATALKAN',
  };
  return map[raw] || 'PEMBAYARAN_BERHASIL';
}

function isPaidWebsiteStatus(status) {
  return normalizeWebsiteStatus(status) === 'PEMBAYARAN_BERHASIL';
}

function isPendingWebsiteStatus(status) {
  return normalizeWebsiteStatus(status) === 'MENUNGGU_PEMBAYARAN';
}

function isCancelledWebsiteStatus(status) {
  return normalizeWebsiteStatus(status) === 'DIBATALKAN';
}

function systemNoteStatus(status) {
  return normalizeWebsiteStatus(status);
}

function systemNote(orderId, status, extra = '') {
  const suffix = extra ? ` | ${extra}` : '';
  return `Order otomatis dari ilenafurniture.com (${orderId}) | Sumber: WEBSITE_ILENA | Status Website: ${systemNoteStatus(status)}${suffix}`;
}

function integrationLockName(orderId, isTest) {
  return `ilena_web_order:${isTest ? 'test' : 'prod'}:${String(orderId).slice(0, 120)}`;
}

async function acquireOrderLock(orderId, isTest) {
  const lockName = integrationLockName(orderId, isTest);
  const rows = await sequelize.query('SELECT GET_LOCK(:lockName, 10) AS locked', {
    replacements: { lockName },
    type: QueryTypes.SELECT,
  });
  return Number(rows?.[0]?.locked || 0) === 1 ? lockName : null;
}

async function releaseOrderLock(lockName) {
  if (!lockName) return;
  await sequelize.query('SELECT RELEASE_LOCK(:lockName)', { replacements: { lockName } }).catch(() => {});
}

async function adjustStok(rows, isTest, direction = 'deduct') {
  const BarangModel = isTest ? BarangTest : Barang;
  for (const row of rows) {
    if (!row._matched || !row.barang_id) continue;
    const barang = await BarangModel.findByPk(row.barang_id);
    if (!barang || !barang.varian) continue;
    let varians = [];
    try { varians = JSON.parse(barang.varian); } catch { varians = []; }
    if (!Array.isArray(varians) || varians.length === 0) continue;

    let updated = false;
    varians = varians.map((v, idx) => {
      const sameVariant = row.varian_id
        ? String(v.id) === String(row.varian_id)
        : (row.varian_nama ? String(v.nama || '').toLowerCase() === String(row.varian_nama).toLowerCase() : idx === 0);
      if (!sameVariant) return v;
      updated = true;
      const delta = Number(row.qty || 0) * (direction === 'restore' ? 1 : -1);
      return { ...v, stok: String(Math.max(0, Number(v.stok || 0) + delta)) };
    });

    if (updated) await barang.update({ varian: JSON.stringify(varians) });
  }
}

function checkToken(req, res, next) {
  const expected = clean(process.env.ILENA_WEB_ORDER_TOKEN || process.env.WEB_ORDER_TOKEN || '');
  const given = clean(req.get('X-Ilena-Webhook-Token') || req.get('X-Webhook-Token') || req.get('X-Luna-Webhook-Token') || '');
  if (!expected || given !== expected) {
    return res.status(401).json({ success: false, message: 'Token integrasi tidak valid' });
  }
  next();
}

router.post('/ilena-web-order', checkToken, async (req, res) => {
  const payload = req.body || {};
  const dryRun = req.get('X-Ilena-Dry-Run') === 'true' || req.get('X-Dry-Run') === 'true' || payload.dry_run === true;
  const orderId = clean(payload.order_id || payload.id_pesanan || payload.saleNumber || '');
  const email = clean(payload.email || payload.customer_email || '').toLowerCase();
  const isTest = payload.is_test === true || payload.is_test === 1 || TEST_EMAILS.includes(email);
  const items = normalizeItems(payload.items || []);
  const websiteStatus = clean(payload.status || payload.order_status || payload.transaction_status || 'Proses');
  const normalizedWebsiteStatus = systemNoteStatus(websiteStatus);
  const isPaidOrder = isPaidWebsiteStatus(websiteStatus);
  const isCancelledOrder = isCancelledWebsiteStatus(websiteStatus);
  const grossAmount = money(payload?.data_mid?.gross_amount ?? payload.gross_amount ?? payload.total ?? items.reduce((s, i) => s + i.subtotal, 0));

  if (!orderId || !items.length) {
    return res.status(400).json({ success: false, message: 'order_id dan items wajib diisi' });
  }

  const itemRows = await resolveItemRows(items, isTest);
  const itemTotal = itemRows.reduce((s, item) => s + Number(item.subtotal || 0), 0);
  const ongkir = Math.max(0, grossAmount - itemTotal);
  const createdBy = Number(process.env.WEBSITE_ORDER_USER_ID || 1);

  if (dryRun) {
    return res.json({
      success: true,
      message: 'Dry run berhasil, data tidak disimpan',
      data: {
        dryRun: true,
        orderId,
        channel: 'WEBSITE',
        status: 'DIPROSES',
        websiteStatus: normalizedWebsiteStatus,
        isTest,
        customerName: clean(payload.nama_pen || payload.nama || payload.customer_name || 'Customer Website'),
        itemCount: itemRows.length,
        matchedItemCount: itemRows.filter((row) => row._matched).length,
      },
    });
  }

  let lockName = null;
  try {
    lockName = await acquireOrderLock(orderId, isTest);
    if (!lockName) {
      return res.status(409).json({
        success: false,
        message: 'Order sedang diproses, coba ulang beberapa detik lagi',
        data: { orderId, locked: true, isTest },
      });
    }

    const existing = await PenjualanOnline.findOne({
      where: { id_pesanan: orderId, is_test: isTest ? 1 : 0 },
    });
    if (existing) {
      if (isCancelledOrder) {
        if (existing.channel !== 'WEBSITE') {
          return res.json({
            success: true,
            message: 'Nomor order sudah ada dari input sistem, pembatalan website tidak menghapus data manual',
            data: { id: existing.id, orderId, action: 'manual_order_preserved', duplicatePrevented: true, isTest, websiteStatus: normalizedWebsiteStatus },
          });
        }
        const existingItems = await PenjualanOnlineItem.findAll({ where: { penjualan_online_id: existing.id } });
        const tDelete = await sequelize.transaction();
        try {
          await ReturOnline.destroy({ where: { penjualan_online_id: existing.id }, transaction: tDelete });
          await PembayaranOnline.destroy({ where: { penjualan_online_id: existing.id }, transaction: tDelete });
          await SuratJalanOnline.destroy({ where: { penjualan_online_id: existing.id }, transaction: tDelete });
          await InvoiceOnline.destroy({ where: { penjualan_online_id: existing.id }, transaction: tDelete });
          await PenjualanOnlineItem.destroy({ where: { penjualan_online_id: existing.id }, transaction: tDelete });
          await PenjualanOnline.destroy({ where: { id: existing.id }, transaction: tDelete });
          await tDelete.commit();
        } catch (err) {
          await tDelete.rollback().catch(() => {});
          throw err;
        }
        if (Number(existing.kurangi_stok || 0) === 1) {
          await adjustStok(existingItems.map((row) => ({ ...row.toJSON(), _matched: true })), isTest, 'restore');
        }
        emitDataUpdated('penjualan-online-list', { updatedBy: existing.created_by, source: 'ilena-web-order-cancel', orderId });
        return res.json({
          success: true,
          message: 'Order website dibatalkan dan dibersihkan dari sistem',
          data: { id: existing.id, orderId, action: 'deleted', duplicatePrevented: true, isTest, websiteStatus: normalizedWebsiteStatus },
        });
      }

      const alreadyPaid = String(existing.catatan || '').includes('PEMBAYARAN_BERHASIL');
      let action = 'duplicate_skipped';
      if (isPaidOrder && !alreadyPaid) {
        await existing.update({
          kurangi_stok: 1,
          catatan: systemNote(orderId, websiteStatus),
        });
        const existingItems = await PenjualanOnlineItem.findAll({ where: { penjualan_online_id: existing.id } });
        await PembayaranOnline.findOrCreate({
          where: { penjualan_online_id: existing.id },
          defaults: {
            metode: existing.metode_pembayaran,
            jumlah: Math.max(0, grossAmount),
            tanggal: existing.tanggal,
            catatan: 'Pembayaran otomatis dari website Ilena / Midtrans',
            created_by: existing.created_by,
          },
        });
        await adjustStok(existingItems.map((row) => ({ ...row.toJSON(), _matched: true })), isTest);
        emitDataUpdated('penjualan-online-list', { updatedBy: existing.created_by, source: 'ilena-web-order-paid', orderId });
        action = 'updated_to_paid';
      }
      return res.json({
        success: true,
        message: 'Order sudah pernah masuk, data ganda dicegah',
        data: { id: existing.id, orderId, action, duplicatePrevented: true, isTest, websiteStatus: normalizedWebsiteStatus },
      });
    }

    if (isCancelledOrder) {
      return res.json({
        success: true,
        message: 'Order website berstatus batal/gagal, tidak dimasukkan ke sistem',
        data: { orderId, action: 'cancelled_skipped', isTest, websiteStatus: normalizedWebsiteStatus },
      });
    }

    const t = await sequelize.transaction();
    try {
    const online = await PenjualanOnline.create({
      id_pesanan: orderId,
      faktur: clean(payload.faktur || 'NON_FAKTUR').toUpperCase() === 'FAKTUR' ? 'FAKTUR' : 'NON_FAKTUR',
      channel: 'WEBSITE',
      nama_pelanggan: clean(payload.nama_pen || payload.nama || payload.customer_name || 'Customer Website'),
      no_hp: clean(payload.hp_pen || payload.nohp || payload.phone || '-'),
      metode_pembayaran: clean(payload.payment_type || payload.metode_pembayaran || payload?.data_mid?.payment_type || 'MIDTRANS').toUpperCase(),
      jasa_kirim: clean(payload.jasa_kirim || payload?.kurir?.nama || payload?.kurir?.courier_name || '') || null,
      nomor_resi: null,
      tanggal: clean(payload.tanggal || payload?.data_mid?.transaction_time || new Date().toISOString()).slice(0, 10),
      alamat_detail: clean(payload.alamat_pen || payload.alamat || payload.shippingAddress || '-'),
      kode_pos: clean(payload.kode_pos || payload.postal_code || '') || null,
      ongkir,
      biaya_lain: 0,
      diskon_order: 0,
      kurangi_stok: isPaidOrder ? 1 : 0,
      catatan: clean(payload.catatan || systemNote(orderId, websiteStatus)),
      status: 'DIPROSES',
      is_test: isTest ? 1 : 0,
      created_by: createdBy,
    }, { transaction: t });

    const rowsForInsert = itemRows.map(({ _matched, ...row }) => ({ ...row, penjualan_online_id: online.id }));
    await PenjualanOnlineItem.bulkCreate(rowsForInsert, { transaction: t });
    if (isPaidOrder) {
      await PembayaranOnline.create({
        penjualan_online_id: online.id,
        metode: online.metode_pembayaran,
        jumlah: Math.max(0, grossAmount || itemTotal),
        tanggal: online.tanggal,
        catatan: 'Pembayaran otomatis dari website Ilena / Midtrans',
        created_by: createdBy,
      }, { transaction: t });
    }

    await t.commit();
    if (isPaidOrder) await adjustStok(itemRows, isTest);
    await logAction(createdBy, 'IMPORT_ORDER_WEBSITE_ILENA', `Order ${orderId}, item ${itemRows.length}, test=${isTest ? 1 : 0}`, req.ip);
    emitDataUpdated('penjualan-online-list', { updatedBy: createdBy, source: 'ilena-web-order', orderId });

    return res.status(201).json({
      success: true,
      message: 'Order website Ilena berhasil masuk sistem',
      data: { id: online.id, orderId, isTest, matchedItemCount: itemRows.filter((row) => row._matched).length },
    });
    } catch (err) {
      await t.rollback().catch(() => {});
      return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    await releaseOrderLock(lockName);
  }
});

router.delete('/ilena-web-order/:orderId', checkToken, async (req, res) => {
  const orderId = clean(req.params.orderId || '');
  const email = clean(req.query.email || req.body?.email || '').toLowerCase();
  const isTest = req.query.is_test === '1' || req.body?.is_test === true || TEST_EMAILS.includes(email);
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId wajib diisi' });

  const online = await PenjualanOnline.findOne({ where: { id_pesanan: orderId, is_test: isTest ? 1 : 0 } });
  if (!online) {
    return res.json({ success: true, message: 'Order tidak ada di sistem, tidak perlu dihapus', data: { orderId, deleted: false } });
  }

  const t = await sequelize.transaction();
  try {
    const items = await PenjualanOnlineItem.findAll({ where: { penjualan_online_id: online.id }, transaction: t });
    await ReturOnline.destroy({ where: { penjualan_online_id: online.id }, transaction: t });
    await PembayaranOnline.destroy({ where: { penjualan_online_id: online.id }, transaction: t });
    await SuratJalanOnline.destroy({ where: { penjualan_online_id: online.id }, transaction: t });
    await InvoiceOnline.destroy({ where: { penjualan_online_id: online.id }, transaction: t });
    await PenjualanOnlineItem.destroy({ where: { penjualan_online_id: online.id }, transaction: t });
    await PenjualanOnline.destroy({ where: { id: online.id }, transaction: t });
    await t.commit();

    if (Number(online.kurangi_stok || 0) === 1) {
      await adjustStok(items.map((row) => ({ ...row.toJSON(), _matched: true })), isTest, 'restore');
    }
    await logAction(online.created_by || Number(process.env.WEBSITE_ORDER_USER_ID || 1), 'HAPUS_ORDER_WEBSITE_ILENA', `Order ${orderId} dibatalkan/gagal di website`, req.ip);
    emitDataUpdated('penjualan-online-list', { updatedBy: online.created_by, source: 'ilena-web-order-delete', orderId });
    return res.json({ success: true, message: 'Order website Ilena dihapus dari sistem', data: { orderId, deleted: true } });
  } catch (err) {
    await t.rollback().catch(() => {});
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
