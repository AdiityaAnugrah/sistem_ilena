const express = require('express');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  PenjualanOnline,
  PenjualanOnlineItem,
  PembayaranOnline,
  ReturOnline,
  SuratJalanOnline,
  InvoiceOnline,
  Barang,
  Provinsi,
  Kabupaten,
  Kecamatan,
  Kelurahan,
} = require('../models');
const BarangTest = require('../models/BarangTest');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');
const { emitDataUpdated } = require('../socket');
const { generateNomorSJOnline, generateNomorInvoiceOnline } = require('../utils/generateNomor');

const router = express.Router();
const money = (value) => Math.round(Number(value || 0));

const STATUS = ['DIPROSES', 'DIKIRIM', 'SELESAI', 'DIBATALKAN', 'RETUR'];
const STATUS_TRANSITIONS = {
  DIPROSES: ['DIKIRIM', 'DIBATALKAN'],
  DIKIRIM: ['SELESAI'],
  SELESAI: [],
  DIBATALKAN: [],
  RETUR: [],
};
const isAllowedStatusTransition = (current, next) => (STATUS_TRANSITIONS[current] || []).includes(next);
const isFullReturn = (totalQty, previousReturQty, newReturQty) => previousReturQty + newReturQty >= totalQty;
const cleanText = (value, fallback = '') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const includeAlamat = [
  { model: Provinsi, as: 'provinsi' },
  { model: Kabupaten, as: 'kabupaten' },
  { model: Kecamatan, as: 'kecamatan' },
  { model: Kelurahan, as: 'kelurahan' },
];

const fullInclude = [
  { model: PenjualanOnlineItem, as: 'items' },
  { model: PembayaranOnline, as: 'pembayarans' },
  { model: SuratJalanOnline, as: 'suratJalans' },
  { model: InvoiceOnline, as: 'invoices' },
  { model: ReturOnline, as: 'returs', include: [{ model: PenjualanOnlineItem, as: 'item' }] },
  ...includeAlamat,
];

async function adjustStok(items, isTest, direction = 'deduct') {
  const BarangModel = isTest ? BarangTest : Barang;
  for (const item of items) {
    if (!item.barang_id) continue;
    const barang = await BarangModel.findByPk(item.barang_id);
    if (!barang || !barang.varian) continue;
    let varians = [];
    try { varians = JSON.parse(barang.varian); } catch { varians = []; }
    if (!Array.isArray(varians) || varians.length === 0) continue;

    let updated = false;
    const delta = Number(item.qty || item.qty_retur || 0) * (direction === 'restore' ? 1 : -1);
    if (item.varian_id) {
      varians = varians.map(v => {
        if (String(v.id) === String(item.varian_id)) {
          updated = true;
          return { ...v, stok: String(Math.max(0, Number(v.stok || 0) + delta)) };
        }
        return v;
      });
    } else {
      varians[0] = { ...varians[0], stok: String(Math.max(0, Number(varians[0].stok || 0) + delta)) };
      updated = true;
    }
    if (updated) await barang.update({ varian: JSON.stringify(varians) });
  }
}

function applyOnlineSummary(penjualan) {
  const data = typeof penjualan.toJSON === 'function' ? penjualan.toJSON() : penjualan;
  const returByItemId = {};
  const refundByItemId = {};
  let totalRefund = 0;
  for (const retur of (data.returs || [])) {
    const itemId = Number(retur.penjualan_online_item_id);
    returByItemId[itemId] = (returByItemId[itemId] || 0) + Number(retur.qty_retur || 0);
    if (retur.tipe === 'PENGEMBALIAN_DANA') {
      refundByItemId[itemId] = (refundByItemId[itemId] || 0) + Number(retur.qty_retur || 0);
      totalRefund += Number(retur.jumlah_refund || 0);
    }
  }

  let subtotalGross = 0;
  let nilaiRetur = 0;
  let subtotalNet = 0;
  let qtyGross = 0;
  let qtyRetur = 0;

  data.items = (data.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const subtotal = money(item.subtotal);
    const returQty = Math.max(0, Number(returByItemId[item.id] || 0));
    const refundQty = Math.max(0, Number(refundByItemId[item.id] || 0));
    const unit = qty > 0 ? subtotal / qty : 0;
    const itemRetur = money(unit * refundQty);
    const itemNet = Math.max(0, money(subtotal - itemRetur));
    subtotalGross += subtotal;
    nilaiRetur += itemRetur;
    subtotalNet += subtotal;
    qtyGross += qty;
    qtyRetur += returQty;
    return {
      ...item,
      qty_retur_total: returQty,
      qty_net: Math.max(0, qty - returQty),
      nilai_retur: itemRetur,
      subtotal_net: itemNet,
    };
  });

  nilaiRetur = money(totalRefund);
  subtotalNet = Math.max(0, money(subtotalNet - nilaiRetur));
  const totalTagihan = money(subtotalNet + Number(data.ongkir || 0) + Number(data.biaya_lain || 0) - Number(data.diskon_order || 0));
  const totalBayar = money((data.pembayarans || []).reduce((s, p) => s + Number(p.jumlah || 0), 0));
  return {
    ...data,
    subtotal_gross: money(subtotalGross),
    total_retur: money(nilaiRetur),
    subtotal_net: money(subtotalNet),
    total_tagihan: Math.max(0, totalTagihan),
    total_bayar: totalBayar,
    sisa_tagihan: Math.max(0, totalTagihan - totalBayar),
    qty_gross: qtyGross,
    qty_retur: qtyRetur,
    qty_net: Math.max(0, qtyGross - qtyRetur),
  };
}

router.post('/', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      id_pesanan, faktur, channel, nama_pelanggan, no_hp, metode_pembayaran, jasa_kirim, nomor_resi,
      tanggal, provinsi_id, kabupaten_id, kecamatan_id, kelurahan_id, alamat_detail, kode_pos,
      ongkir = 0, biaya_lain = 0, diskon_order = 0, kurangi_stok = true, catatan, items,
    } = req.body;

    if (!id_pesanan || !nama_pelanggan || !no_hp || !alamat_detail) {
      await t.rollback();
      return res.status(400).json({ message: 'ID Pesanan, nama pelanggan, nomor telepon, dan alamat wajib diisi' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 produk wajib diisi' });
    }

    const is_test = req.user.role === 'TEST' ? 1 : 0;
    const exists = await PenjualanOnline.findOne({ where: { id_pesanan, is_test }, transaction: t });
    if (exists) {
      await t.rollback();
      return res.status(400).json({ message: 'ID Pesanan sudah digunakan' });
    }

    const online = await PenjualanOnline.create({
      id_pesanan: String(id_pesanan).trim(),
      faktur: faktur === 'FAKTUR' ? 'FAKTUR' : 'NON_FAKTUR',
      channel: cleanText(channel, 'LAINNYA').toUpperCase(),
      nama_pelanggan,
      no_hp,
      metode_pembayaran: cleanText(metode_pembayaran, 'LAINNYA').toUpperCase(),
      jasa_kirim: jasa_kirim || null,
      nomor_resi: nomor_resi || null,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      provinsi_id: provinsi_id || null,
      kabupaten_id: kabupaten_id || null,
      kecamatan_id: kecamatan_id || null,
      kelurahan_id: kelurahan_id || null,
      alamat_detail,
      kode_pos: kode_pos || null,
      ongkir: money(ongkir),
      biaya_lain: money(biaya_lain),
      diskon_order: money(diskon_order),
      kurangi_stok: kurangi_stok ? 1 : 0,
      catatan: catatan || null,
      status: 'DIPROSES',
      is_test,
      created_by: req.user.id,
    }, { transaction: t });

    const itemRows = items.map(item => ({
      penjualan_online_id: online.id,
      barang_id: item.barang_id,
      varian_nama: item.varian_nama || null,
      varian_id: item.varian_id || null,
      qty: Number(item.qty || 1),
      harga_satuan: money(item.harga_satuan),
      diskon: Number(item.diskon || 0),
      subtotal: money(Number(item.qty || 1) * Number(item.harga_satuan || 0) * (1 - Math.max(0, Number(item.diskon || 0)) / 100)),
    }));
    await PenjualanOnlineItem.bulkCreate(itemRows, { transaction: t });

    const totalProduk = itemRows.reduce((s, item) => s + Number(item.subtotal || 0), 0);
    const totalTagihan = money(totalProduk + Number(ongkir || 0) + Number(biaya_lain || 0) - Number(diskon_order || 0));
    await PembayaranOnline.create({
      penjualan_online_id: online.id,
      metode: online.metode_pembayaran,
      jumlah: Math.max(0, totalTagihan),
      tanggal: online.tanggal,
      catatan: 'Pembayaran otomatis dari input pesanan online',
      created_by: req.user.id,
    }, { transaction: t });

    await t.commit();
    if (online.kurangi_stok === 1) {
      await adjustStok(itemRows, is_test === 1, 'deduct');
    }
    await logAction(req.user.id, 'BUAT_PENJUALAN_ONLINE', `ID Pesanan: ${online.id_pesanan}, Channel: ${online.channel}`, req.ip);
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.status(201).json({ id: online.id, message: 'Penjualan online berhasil dibuat' });
  } catch (err) {
    await t.rollback().catch(() => {});
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, channel, status, tanggal_dari, tanggal_sampai, page = 1, limit = 20 } = req.query;
    const where = { is_test: req.user.role === 'TEST' ? 1 : 0 };
    if (channel) where.channel = { [Op.like]: `%${String(channel).trim()}%` };
    if (status) where.status = String(status).toUpperCase();
    if (tanggal_dari || tanggal_sampai) {
      where.tanggal = {};
      if (tanggal_dari) where.tanggal[Op.gte] = tanggal_dari;
      if (tanggal_sampai) where.tanggal[Op.lte] = tanggal_sampai;
    }
    if (search) {
      where[Op.or] = [
        { id_pesanan: { [Op.like]: `%${search}%` } },
        { nama_pelanggan: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
        { nomor_resi: { [Op.like]: `%${search}%` } },
      ];
    }

    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageInt - 1) * limitInt;

    const [count, summaryRows, rows] = await Promise.all([
      PenjualanOnline.count({ where }),
      PenjualanOnline.findAll({ where }),
      PenjualanOnline.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: limitInt,
        offset,
      }),
    ]);

    const attachOnlineRelations = async (onlineRows, includeBarang = false) => {
      const ids = onlineRows.map(row => Number(row.id)).filter(Boolean);
      if (ids.length === 0) return onlineRows;

      const [items, pembayarans, suratJalans, invoices, returs] = await Promise.all([
        PenjualanOnlineItem.findAll({ where: { penjualan_online_id: { [Op.in]: ids } } }).catch(err => { console.error('[GET /api/penjualan-online] items error:', err.message, err.sql || ''); return []; }),
        PembayaranOnline.findAll({ where: { penjualan_online_id: { [Op.in]: ids } } }).catch(err => { console.error('[GET /api/penjualan-online] pembayaran error:', err.message, err.sql || ''); return []; }),
        SuratJalanOnline.findAll({ where: { penjualan_online_id: { [Op.in]: ids } } }).catch(err => { console.error('[GET /api/penjualan-online] surat jalan error:', err.message, err.sql || ''); return []; }),
        InvoiceOnline.findAll({ where: { penjualan_online_id: { [Op.in]: ids } } }).catch(err => { console.error('[GET /api/penjualan-online] invoice error:', err.message, err.sql || ''); return []; }),
        ReturOnline.findAll({ where: { penjualan_online_id: { [Op.in]: ids } } }).catch(err => { console.error('[GET /api/penjualan-online] retur error:', err.message, err.sql || ''); return []; }),
      ]);

      const groupByPenjualan = (list) => list.reduce((acc, row) => {
        const key = Number(row.penjualan_online_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});

      let itemsWithBarang = items;
      if (includeBarang && items.length > 0) {
        const barangIds = [...new Set(items.map(item => item.barang_id).filter(Boolean))];
        const barangs = await Barang.findAll({ where: { id: { [Op.in]: barangIds } } }).catch(err => {
          console.error('[GET /api/penjualan-online] barang error:', err.message, err.sql || '');
          return [];
        });
        const barangMap = barangs.reduce((acc, barang) => { acc[String(barang.id)] = barang; return acc; }, {});
        itemsWithBarang = items.map(item => {
          const data = item.toJSON ? item.toJSON() : item;
          return { ...data, barang: barangMap[String(data.barang_id)] || null };
        });
      }

      const itemMap = groupByPenjualan(itemsWithBarang);
      const pembayaranMap = groupByPenjualan(pembayarans);
      const suratJalanMap = groupByPenjualan(suratJalans);
      const invoiceMap = groupByPenjualan(invoices);
      const returMap = groupByPenjualan(returs);

      return onlineRows.map(row => {
        const data = row.toJSON ? row.toJSON() : row;
        const id = Number(data.id);
        return {
          ...data,
          items: itemMap[id] || [],
          pembayarans: pembayaranMap[id] || [],
          suratJalans: suratJalanMap[id] || [],
          invoices: invoiceMap[id] || [],
          returs: returMap[id] || [],
        };
      });
    };

    const summaryWithRelations = await attachOnlineRelations(summaryRows, false);
    const summary = summaryWithRelations.map(applyOnlineSummary).reduce((acc, row) => {
      acc.totalNilai += Number(row.total_tagihan || 0);
      acc.totalBayar += Number(row.total_bayar || 0);
      acc.totalRetur += Number(row.total_retur || 0);
      acc.totalQty += Number(row.qty_net || 0);
      return acc;
    }, { totalNilai: 0, totalBayar: 0, totalRetur: 0, totalQty: 0 });

    const rowsWithRelations = await attachOnlineRelations(rows, true);

    return res.json({
      data: rowsWithRelations.map(applyOnlineSummary),
      total: count,
      page: pageInt,
      totalPages: Math.ceil(count / limitInt),
      summary: {
        totalNilai: money(summary.totalNilai),
        totalBayar: money(summary.totalBayar),
        totalRetur: money(summary.totalRetur),
        totalQty: summary.totalQty,
      },
    });
  } catch (err) {
    console.error('[GET /api/penjualan-online] Error:', err.message, err.sql || '');
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/surat-jalan', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (online.status !== 'DIKIRIM') {
      return res.status(400).json({ message: 'Ubah status pesanan ke DIKIRIM sebelum membuat Surat Jalan' });
    }
    const invoicePrinted = await InvoiceOnline.findOne({
      where: { penjualan_online_id: online.id, printed_at: { [Op.ne]: null } },
    });
    if (!invoicePrinted) {
      return res.status(400).json({ message: 'Cetak Invoice terlebih dahulu sebelum membuat Surat Jalan' });
    }
    const existing = await SuratJalanOnline.findOne({ where: { penjualan_online_id: online.id } });
    if (existing) {
      return res.status(400).json({ message: 'Surat Jalan untuk pesanan ini sudah dibuat' });
    }
    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    const nomor_surat = await generateNomorSJOnline(online.faktur, tanggal, online.is_test === 1);
    const sj = await SuratJalanOnline.create({
      penjualan_online_id: online.id,
      nomor_surat,
      tanggal,
      catatan: req.body.catatan || null,
      created_by: req.user.id,
    });
    await logAction(req.user.id, 'BUAT_SJ_ONLINE', `Nomor: ${nomor_surat}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: sj.id, nomor_surat, message: 'Surat Jalan Online berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/invoice', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (['DIBATALKAN', 'RETUR'].includes(online.status)) {
      return res.status(400).json({ message: `Invoice tidak dapat dibuat saat status ${online.status}` });
    }
    const existing = await InvoiceOnline.findOne({ where: { penjualan_online_id: online.id } });
    if (existing) {
      return res.status(400).json({ message: 'Invoice untuk pesanan ini sudah dibuat' });
    }
    const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
    const nomor_invoice = await generateNomorInvoiceOnline(online.faktur, tanggal, online.is_test === 1);
    const jatuh_tempo = new Date(new Date(tanggal).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const inv = await InvoiceOnline.create({
      penjualan_online_id: online.id,
      nomor_invoice,
      tanggal,
      jatuh_tempo,
      catatan: req.body.catatan || null,
      created_by: req.user.id,
    });
    await logAction(req.user.id, 'BUAT_INVOICE_ONLINE', `Nomor: ${nomor_invoice}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    return res.status(201).json({ id: inv.id, nomor_invoice, message: 'Invoice Online berhasil dibuat' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id, { include: fullInclude });
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const data = online.toJSON ? online.toJSON() : online;
    const barangIds = [...new Set((data.items || []).map(item => item.barang_id).filter(Boolean))];
    if (barangIds.length > 0) {
      const barangs = await Barang.findAll({ where: { id: { [Op.in]: barangIds } } }).catch(err => {
        console.error('[GET /api/penjualan-online/:id] barang error:', err.message, err.sql || '');
        return [];
      });
      const barangMap = barangs.reduce((acc, barang) => { acc[String(barang.id)] = barang; return acc; }, {});
      data.items = (data.items || []).map(item => ({ ...item, barang: barangMap[String(item.barang_id)] || null }));
    }

    return res.json(applyOnlineSummary(data));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    const status = String(req.body.status || '').toUpperCase();
    if (!STATUS.includes(status)) return res.status(400).json({ message: 'Status tidak valid' });
    if (status === online.status) return res.json({ message: 'Status tidak berubah', status });
    if (!isAllowedStatusTransition(online.status, status)) {
      return res.status(400).json({
        message: `Status tidak dapat diubah dari ${online.status} ke ${status}. Status yang sudah maju tidak dapat dikembalikan.`,
      });
    }

    const updates = { status };
    if (status === 'DIKIRIM') {
      const invoicePrinted = await InvoiceOnline.findOne({ where: { penjualan_online_id: online.id, printed_at: { [Op.ne]: null } } });
      if (!invoicePrinted) return res.status(400).json({ message: 'Invoice wajib dicetak sebelum pesanan dikirim' });
    }
    if (status === 'SELESAI') {
      const suratJalan = await SuratJalanOnline.findOne({ where: { penjualan_online_id: online.id, jenis: 'PENGIRIMAN_AWAL' } });
      if (!suratJalan) return res.status(400).json({ message: 'Surat Jalan wajib dibuat sebelum menyelesaikan pesanan' });
      const rawPendapatan = req.body.pendapatan_bersih;
      if (rawPendapatan === '' || rawPendapatan === null || rawPendapatan === undefined) {
        return res.status(400).json({ message: 'Pendapatan bersih wajib diisi sebelum menyelesaikan pesanan' });
      }
      const pendapatanBersih = Number(rawPendapatan);
      if (!Number.isFinite(pendapatanBersih) || pendapatanBersih < 0) {
        return res.status(400).json({ message: 'Pendapatan bersih harus berupa angka nol atau lebih' });
      }
      updates.pendapatan_bersih = money(pendapatanBersih);
    }
    await online.update(updates);
    await logAction(req.user.id, 'UPDATE_STATUS_ONLINE', `Penjualan Online #${online.id} → ${status}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.json({ message: 'Status berhasil diperbarui', status });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/resi', authenticate, async (req, res) => {
  try {
    const online = await PenjualanOnline.findByPk(req.params.id);
    if (!online) return res.status(404).json({ message: 'Data tidak ditemukan' });
    if (req.body.nomor_resi && online.status === 'DIPROSES') {
      return res.status(400).json({ message: 'Ubah status ke DIKIRIM melalui tombol status setelah Invoice dicetak' });
    }
    await online.update({
      nomor_resi: req.body.nomor_resi || null,
      jasa_kirim: req.body.jasa_kirim || online.jasa_kirim,
    });
    await logAction(req.user.id, 'UPDATE_RESI_ONLINE', `Penjualan Online #${online.id}, Resi: ${req.body.nomor_resi || '-'}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.json({ message: 'Resi berhasil diperbarui' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/retur', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const online = await PenjualanOnline.findByPk(req.params.id, {
      include: [{ model: PenjualanOnlineItem, as: 'items' }, { model: ReturOnline, as: 'returs' }],
      transaction: t,
    });
    if (!online) {
      await t.rollback();
      return res.status(404).json({ message: 'Penjualan online tidak ditemukan' });
    }
    if (!['DIKIRIM', 'SELESAI'].includes(online.status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Retur hanya dapat dicatat setelah pesanan DIKIRIM atau SELESAI' });
    }
    const { tanggal, catatan, items, tipe, jumlah_refund, surat_jalan_awal_id, tanggal_sj_pengganti } = req.body;
    const returTipe = String(tipe || '').toUpperCase();
    if (!['PENGGANTIAN_BARANG', 'PENGEMBALIAN_DANA'].includes(returTipe)) {
      await t.rollback();
      return res.status(400).json({ message: 'Pilih jenis retur: penggantian barang atau pengembalian dana' });
    }
    if (!String(catatan || '').trim()) {
      await t.rollback();
      return res.status(400).json({ message: 'Alasan retur wajib diisi' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Minimal 1 item retur wajib diisi' });
    }
    const sjAwal = await SuratJalanOnline.findOne({
      where: { id: surat_jalan_awal_id, penjualan_online_id: online.id, jenis: 'PENGIRIMAN_AWAL' },
      transaction: t,
    });
    if (!sjAwal) {
      await t.rollback();
      return res.status(400).json({ message: 'Surat Jalan pengiriman awal wajib dipilih' });
    }
    const refund = returTipe === 'PENGEMBALIAN_DANA' ? Number(jumlah_refund) : 0;
    if (returTipe === 'PENGEMBALIAN_DANA' && (!Number.isFinite(refund) || refund <= 0)) {
      await t.rollback();
      return res.status(400).json({ message: 'Nominal pengembalian dana wajib diisi dan harus lebih dari nol' });
    }
    if (returTipe === 'PENGGANTIAN_BARANG' && !tanggal_sj_pengganti) {
      await t.rollback();
      return res.status(400).json({ message: 'Tanggal SJ penggantian wajib diisi' });
    }
    const existing = {};
    for (const r of online.returs || []) existing[r.penjualan_online_item_id] = (existing[r.penjualan_online_item_id] || 0) + Number(r.qty_retur || 0);

    const restoreItems = [];
    const returGroupId = randomUUID();
    for (const [rowIndex, row] of items.entries()) {
      const itemId = Number(row.penjualan_online_item_id);
      const qtyRetur = Number(row.qty_retur);
      const item = (online.items || []).find(i => Number(i.id) === itemId);
      if (!item || !qtyRetur || qtyRetur <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Item retur tidak valid' });
      }
      const sisa = Math.max(0, Number(item.qty || 0) - Number(existing[itemId] || 0));
      if (qtyRetur > sisa) {
        await t.rollback();
        return res.status(400).json({ message: `Qty retur melebihi sisa retur untuk ${item.varian_nama || item.barang_id}. Sisa: ${sisa}` });
      }
      await ReturOnline.create({
        penjualan_online_id: online.id,
        penjualan_online_item_id: itemId,
        qty_retur: qtyRetur,
        retur_group_id: returGroupId,
        tipe: returTipe,
        jumlah_refund: rowIndex === 0 ? money(refund) : 0,
        surat_jalan_awal_id: sjAwal.id,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        catatan: catatan || null,
        created_by: req.user.id,
      }, { transaction: t });
      restoreItems.push({ ...item.dataValues, qty: qtyRetur });
    }
    const totalQty = (online.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const previousReturQty = Object.values(existing).reduce((sum, qty) => sum + Number(qty || 0), 0);
    const newReturQty = restoreItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const isReturPenuh = isFullReturn(totalQty, previousReturQty, newReturQty);
    let sjPengganti = null;
    if (returTipe === 'PENGGANTIAN_BARANG') {
      const nomorSurat = await generateNomorSJOnline(online.faktur, tanggal_sj_pengganti, online.is_test === 1);
      sjPengganti = await SuratJalanOnline.create({
        penjualan_online_id: online.id,
        nomor_surat: nomorSurat,
        tanggal: tanggal_sj_pengganti,
        catatan: `Penggantian barang retur dari ${sjAwal.nomor_surat}${catatan ? ` - ${catatan}` : ''}`,
        jenis: 'PENGGANTIAN_RETUR',
        retur_group_id: returGroupId,
        created_by: req.user.id,
      }, { transaction: t });
      await ReturOnline.update({ surat_jalan_pengganti_id: sjPengganti.id }, { where: { retur_group_id: returGroupId }, transaction: t });
    } else {
      const updates = {};
      if (isReturPenuh) updates.status = 'RETUR';
      if (online.pendapatan_bersih !== null) updates.pendapatan_bersih = Math.max(0, money(online.pendapatan_bersih) - money(refund));
      if (Object.keys(updates).length > 0) await online.update(updates, { transaction: t });
    }
    await t.commit();
    if (online.kurangi_stok === 1) {
      await adjustStok(restoreItems, online.is_test === 1, 'restore');
      if (returTipe === 'PENGGANTIAN_BARANG') {
        await adjustStok(restoreItems, online.is_test === 1, 'deduct');
      }
    }
    await logAction(req.user.id, 'CATAT_RETUR_ONLINE', `Penjualan Online #${online.id}, ${returTipe}, ${restoreItems.length} item${sjPengganti ? `, SJ ${sjPengganti.nomor_surat}` : `, refund ${money(refund)}`}`, req.ip);
    emitDataUpdated(`penjualan-online:${online.id}`, { updatedBy: req.user.id });
    emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
    return res.status(201).json({
      message: returTipe === 'PENGGANTIAN_BARANG' ? 'Retur barang dan SJ penggantian berhasil dibuat' : 'Pengembalian dana berhasil dicatat',
      retur_penuh: returTipe === 'PENGEMBALIAN_DANA' && isReturPenuh,
      status: returTipe === 'PENGEMBALIAN_DANA' && isReturPenuh ? 'RETUR' : online.status,
      surat_jalan_pengganti: sjPengganti ? { id: sjPengganti.id, nomor_surat: sjPengganti.nomor_surat } : null,
    });
  } catch (err) {
    await t.rollback().catch(() => {});
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.__testables = { isAllowedStatusTransition, isFullReturn };

module.exports = router;
