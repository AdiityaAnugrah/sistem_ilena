const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  Barang,
  PenjualanOnline,
  PenjualanOnlineItem,
  PembayaranOnline,
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

async function adjustStok(rows, isTest) {
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
      return { ...v, stok: String(Math.max(0, Number(v.stok || 0) - Number(row.qty || 0))) };
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
        isTest,
        customerName: clean(payload.nama_pen || payload.nama || payload.customer_name || 'Customer Website'),
        itemCount: itemRows.length,
        matchedItemCount: itemRows.filter((row) => row._matched).length,
      },
    });
  }

  const existing = await PenjualanOnline.findOne({ where: { id_pesanan: orderId, is_test: isTest ? 1 : 0 } });
  if (existing) {
    return res.json({
      success: true,
      message: 'Order sudah pernah masuk',
      data: { id: existing.id, orderId, duplicate: true, isTest },
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
      kurangi_stok: 1,
      catatan: clean(payload.catatan || `Order otomatis dari ilenafurniture.com (${orderId})`),
      status: 'DIPROSES',
      is_test: isTest ? 1 : 0,
      created_by: createdBy,
    }, { transaction: t });

    const rowsForInsert = itemRows.map(({ _matched, ...row }) => ({ ...row, penjualan_online_id: online.id }));
    await PenjualanOnlineItem.bulkCreate(rowsForInsert, { transaction: t });
    await PembayaranOnline.create({
      penjualan_online_id: online.id,
      metode: online.metode_pembayaran,
      jumlah: Math.max(0, grossAmount || itemTotal),
      tanggal: online.tanggal,
      catatan: 'Pembayaran otomatis dari website Ilena / Midtrans',
      created_by: createdBy,
    }, { transaction: t });

    await t.commit();
    await adjustStok(itemRows, isTest);
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
});

module.exports = router;
