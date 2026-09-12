const router = require('../penjualanOnline');

const { isAllowedStatusTransition, isFullReturn, calculateTotalAfterRefund } = router.__testables;

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
