const router = require('../penjualanOnline');

const { isAllowedStatusTransition, isFullReturn, calculateTotalAfterRefund, validateOnlineAmounts } = router.__testables;

describe('alur status dan retur penjualan online', () => {
  test('status hanya dapat bergerak maju', () => {
    expect(isAllowedStatusTransition('DIPROSES', 'DIKIRIM')).toBe(true);
    expect(isAllowedStatusTransition('DIKIRIM', 'SELESAI')).toBe(true);
    expect(isAllowedStatusTransition('DIKIRIM', 'DIPROSES')).toBe(false);
    expect(isAllowedStatusTransition('SELESAI', 'DIKIRIM')).toBe(false);
  });

  test('pembatalan hanya dapat dilakukan saat masih diproses', () => {
    expect(isAllowedStatusTransition('DIPROSES', 'DIBATALKAN')).toBe(true);
    expect(isAllowedStatusTransition('DIKIRIM', 'DIBATALKAN')).toBe(false);
  });

  test('retur sebagian tidak dianggap retur penuh', () => {
    expect(isFullReturn(10, 2, 3)).toBe(false);
  });

  test('akumulasi retur seluruh qty dianggap retur penuh', () => {
    expect(isFullReturn(10, 4, 6)).toBe(true);
  });
});

describe('perhitungan pengembalian dana online', () => {
  test('total tetap normal jika tidak ada retur', () => {
    expect(calculateTotalAfterRefund(100000, 10000, 5000, 5000, 0)).toBe(110000);
  });

  test('refund mengurangi seluruh total termasuk ongkir', () => {
    expect(calculateTotalAfterRefund(100000, 10000, 0, 0, 110000)).toBe(0);
    expect(calculateTotalAfterRefund(100000, 10000, 0, 0, 25000)).toBe(85000);
  });
});

describe('validasi nominal penjualan online', () => {
  const valid = { items: [{ barang_id: 'BRG-1', varian_id: 'V1', qty: 2, harga_satuan: 50000, diskon: 10 }], ongkir: 10000, biaya_lain: 0, diskon_order: 5000 };

  test('menerima nominal transaksi yang valid', () => {
    expect(validateOnlineAmounts(valid)).toBeNull();
  });

  test('menolak qty nol, harga negatif, dan diskon di atas 100 persen', () => {
    expect(validateOnlineAmounts({ ...valid, items: [{ ...valid.items[0], qty: 0 }] })).toMatch(/Qty/);
    expect(validateOnlineAmounts({ ...valid, items: [{ ...valid.items[0], harga_satuan: -1 }] })).toMatch(/Harga/);
    expect(validateOnlineAmounts({ ...valid, items: [{ ...valid.items[0], diskon: 101 }] })).toMatch(/Diskon produk/);
  });

  test('menolak biaya negatif dan item duplikat', () => {
    expect(validateOnlineAmounts({ ...valid, ongkir: -1 })).toMatch(/Ongkir/);
    expect(validateOnlineAmounts({ ...valid, items: [valid.items[0], { ...valid.items[0] }] })).toMatch(/tidak boleh dimasukkan dua kali/);
  });
});
