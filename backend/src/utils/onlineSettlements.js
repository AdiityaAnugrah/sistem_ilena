const { financeDateRangeError } = require('./financeDateRange');

function validateSettlement(body) {
  const tanggal = body.tanggal;
  const dateError = financeDateRangeError({ from: tanggal });
  if (!tanggal || dateError) throw Object.assign(Error(dateError || 'Tanggal pencairan wajib diisi'), { status: 400 });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  if (tanggal > today) throw Object.assign(Error('Tanggal pencairan belum terjadi'), { status: 400 });
  const referensi = String(body.referensi || '').trim();
  if (!referensi || referensi.length > 120) throw Object.assign(Error('Referensi pencairan wajib diisi, maksimal120 karakter'), { status: 400 });
  const jumlah_bruto = Number(body.jumlah_bruto), biaya = Number(body.biaya);
  const numeric = raw => typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw));
  if (!numeric(body.jumlah_bruto) || !numeric(body.biaya) || !Number.isSafeInteger(jumlah_bruto) || jumlah_bruto <= 0 || jumlah_bruto > 9999999999999 || !Number.isSafeInteger(biaya) || biaya < 0 || biaya > jumlah_bruto) {
    throw Object.assign(Error('Nominal bruto dan biaya harus rupiah bulat; bruto positif dan biaya antara 0 sampai bruto'), { status: 400 });
  }
  return { tanggal, referensi, jumlah_bruto, biaya, jumlah_bersih: jumlah_bruto - biaya, catatan: String(body.catatan || '').trim() || null };
}

function assertGatewayAvailable(payments, refunds, settlements, proposed) {
  const events = [
    ...payments.map(row => ({ tanggal: row.tanggal, priority: 0, amount: Number(row.jumlah) })),
    ...refunds.map(row => ({ tanggal: row.tanggal, priority: 1, amount: -Number(row.jumlah_refund) })),
    ...settlements.map(row => ({ tanggal: row.tanggal, priority: 2, amount: -Number(row.jumlah_bruto) })),
    { tanggal: proposed.tanggal, priority: 2, amount: -proposed.jumlah_bruto },
  ].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || a.priority - b.priority);
  let saldo = 0;
  for (const event of events) {
    saldo += event.amount;
    if (saldo < 0) throw Object.assign(Error('Pencairan melebihi saldo gateway pada tanggal transaksi atau mengganggu transaksi sesudahnya'), { status: 400 });
  }
}

function registerOnlineSettlements(router, { models, authenticate, logAction, emitDataUpdated }) {
  const { sequelize, PenjualanOnline, PembayaranOnline, ReturOnline, PencairanOnline } = models;
  router.post('/:id/pencairan', authenticate, async (req, res) => {
    if (!['ADMIN', 'SUPER_ADMIN', 'DEV', 'TEST'].includes(req.user.role)) return res.status(403).json({ message: 'Akses ditolak' });
    let transaction;
    try {
      const value = validateSettlement(req.body);
      transaction = await sequelize.transaction();
      const parent = await PenjualanOnline.findOne({ where: { id: req.params.id, is_test: req.user.role === 'TEST' ? 1 : 0 }, transaction, lock: transaction.LOCK.UPDATE });
      if (!parent) throw Object.assign(Error('Pesanan tidak ditemukan'), { status: 404 });
      const where = { penjualan_online_id: parent.id };
      const existing = await PencairanOnline.findAll({ where, transaction });
      const repeated = existing.find(row => row.referensi.toLowerCase() === value.referensi.toLowerCase());
      if (repeated) {
        if (repeated.tanggal !== value.tanggal || Number(repeated.jumlah_bruto) !== value.jumlah_bruto || Number(repeated.biaya) !== value.biaya) throw Object.assign(Error('Referensi sudah dipakai untuk pencairan dengan nilai berbeda'), { status: 409 });
        await transaction.commit(); transaction = null;
        return res.json({ id: repeated.id, message: 'Pencairan sudah tercatat', duplicate: true });
      }
      const [payments, refunds] = await Promise.all([
        PembayaranOnline.findAll({ where, transaction }),
        ReturOnline.findAll({ where: { ...where, tipe: 'PENGEMBALIAN_DANA' }, transaction }),
      ]);
      assertGatewayAvailable(payments, refunds, existing, value);
      const row = await PencairanOnline.create({ ...value, ...where, created_by: req.user.id }, { transaction });
      await transaction.commit(); transaction = null;
      await logAction(req.user.id, 'PENCAIRAN_ONLINE', `Pesanan#${parent.id}, pencairan#${row.id}`, req.ip);
      emitDataUpdated('penjualan-online-list', { updatedBy: req.user.id });
      emitDataUpdated(`penjualan-online:${parent.id}`, { updatedBy: req.user.id });
      return res.status(201).json({ id: row.id, message: 'Pencairan bank tercatat' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({ message: error.status ? error.message : 'Pencairan gagal disimpan' });
    }
  });
}
module.exports = { validateSettlement, assertGatewayAvailable, registerOnlineSettlements };
