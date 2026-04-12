const dayjs = require('dayjs');
const { DocumentCounter } = require('../models');
const sequelize = require('../config/database');

/**
 * Get and increment document counter for a given type, month, year
 * Uses a transaction to prevent race conditions
 */
const getNextNumber = async (tipe, bulan, tahun) => {
  return await sequelize.transaction(async (t) => {
    const [counter, created] = await DocumentCounter.findOrCreate({
      where: { tipe, bulan, tahun },
      defaults: { last_number: 0 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    counter.last_number += 1;
    await counter.save({ transaction: t });
    return counter.last_number;
  });
};

/**
 * Generate Surat Jalan number
 * FAKTUR:     0001/SJ/04/2026
 * NON_FAKTUR: NF0001/SJ/04/2026
 */
const generateNomorSJ = async (faktur, tanggal) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const tipe = faktur === 'FAKTUR' ? 'SJ_FAKTUR' : 'SJ_NON_FAKTUR';
  const num = await getNextNumber(tipe, bulan, tahun);
  const padded = String(num).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return `${prefix}${padded}/SJ/${mm}/${tahun}`;
};

/**
 * Generate Invoice number
 * FAKTUR:     00001/INV/CBM/04/2026
 * NON_FAKTUR: NF00001/INV/CBM/04/2026
 */
const generateNomorInvoice = async (faktur, tanggal) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const tipe = faktur === 'FAKTUR' ? 'INV_FAKTUR' : 'INV_NON_FAKTUR';
  const num = await getNextNumber(tipe, bulan, tahun);
  const padded = String(num).padStart(5, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return `${prefix}${padded}/INV/CBM/${mm}/${tahun}`;
};

/**
 * Generate Surat Pengantar number
 * FAKTUR:     0001/SP/04/2026
 * NON_FAKTUR: NF0001/SP/04/2026
 */
const generateNomorSP = async (faktur, tanggal) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const tipe = faktur === 'FAKTUR' ? 'SP_FAKTUR' : 'SP_NON_FAKTUR';
  const num = await getNextNumber(tipe, bulan, tahun);
  const padded = String(num).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return `${prefix}${padded}/SP/${mm}/${tahun}`;
};

/**
 * Generate Proforma Invoice number
 * PRF00001/04/2026
 */
const generateNomorProforma = async (tanggal) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const num = await getNextNumber('PROFORMA', bulan, tahun);
  const padded = String(num).padStart(5, '0');
  const mm = String(bulan).padStart(2, '0');
  return `PRF${padded}/${mm}/${tahun}`;
};

module.exports = {
  generateNomorSJ,
  generateNomorInvoice,
  generateNomorSP,
  generateNomorProforma,
};
