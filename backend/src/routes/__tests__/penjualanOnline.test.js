const router = require('../penjualanOnline');

const { isAllowedStatusTransition, isFullReturn } = router.__testables;

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
