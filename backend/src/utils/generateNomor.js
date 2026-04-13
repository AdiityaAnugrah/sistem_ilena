const dayjs = require('dayjs');
const { DocumentCounter } = require('../models');
const sequelize = require('../config/database');

/**
 * Get and increment document counter for a given type and year.
 * Counter resets to 1 each new year (bulan=0 used as annual placeholder).
 * Uses a transaction to prevent race conditions.
 */
const getNextNumber = async (tipe, tahun) => {
  return await sequelize.transaction(async (t) => {
    const [counter] = await DocumentCounter.findOrCreate({
      where: { tipe, bulan: 0, tahun },
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
 * FAKTUR:     0001/SJ/04/2026        | TEST: TEST-0001/SJ/04/2026
 * NON_FAKTUR: NF0001/SJ/04/2026      | TEST: TEST-NF0001/SJ/04/2026
 */
const generateNomorSJ = async (faktur, tanggal, isTest = false) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const base = faktur === 'FAKTUR' ? 'SJ_FAKTUR' : 'SJ_NON_FAKTUR';
  const tipe = isTest ? `TEST_${base}` : base;
  const num = await getNextNumber(tipe, tahun);
  const padded = String(num).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return isTest
    ? `TEST-${prefix}${padded}/SJ/${mm}/${tahun}`
    : `${prefix}${padded}/SJ/${mm}/${tahun}`;
};

/**
 * Generate Invoice number
 * FAKTUR:     00001/INV/CBM/04/2026  | TEST: TEST-00001/INV/CBM/04/2026
 * NON_FAKTUR: NF00001/INV/CBM/04/2026
 */
const generateNomorInvoice = async (faktur, tanggal, isTest = false) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const base = faktur === 'FAKTUR' ? 'INV_FAKTUR' : 'INV_NON_FAKTUR';
  const tipe = isTest ? `TEST_${base}` : base;
  const num = await getNextNumber(tipe, tahun);
  const padded = String(num).padStart(5, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return isTest
    ? `TEST-${prefix}${padded}/INV/CBM/${mm}/${tahun}`
    : `${prefix}${padded}/INV/CBM/${mm}/${tahun}`;
};

/**
 * Generate Surat Pengantar number
 * FAKTUR:     0001/SP/04/2026        | TEST: TEST-0001/SP/04/2026
 * NON_FAKTUR: NF0001/SP/04/2026
 */
const generateNomorSP = async (faktur, tanggal, isTest = false) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const base = faktur === 'FAKTUR' ? 'SP_FAKTUR' : 'SP_NON_FAKTUR';
  const tipe = isTest ? `TEST_${base}` : base;
  const num = await getNextNumber(tipe, tahun);
  const padded = String(num).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  const prefix = faktur === 'FAKTUR' ? '' : 'NF';
  return isTest
    ? `TEST-${prefix}${padded}/SP/${mm}/${tahun}`
    : `${prefix}${padded}/SP/${mm}/${tahun}`;
};

/**
 * Generate Proforma Invoice number
 * 0004/PRO-INV/CBM/03/2026  | TEST: TEST-0004/PRO-INV/CBM/03/2026
 */
const generateNomorProforma = async (tanggal, isTest = false) => {
  const d = dayjs(tanggal);
  const bulan = d.month() + 1;
  const tahun = d.year();
  const tipe = isTest ? 'TEST_PROFORMA' : 'PROFORMA';
  const num = await getNextNumber(tipe, tahun);
  const padded = String(num).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  return isTest
    ? `TEST-${padded}/PRO-INV/CBM/${mm}/${tahun}`
    : `${padded}/PRO-INV/CBM/${mm}/${tahun}`;
};

module.exports = {
  generateNomorSJ,
  generateNomorInvoice,
  generateNomorSP,
  generateNomorProforma,
};
