const router = require('../piutangUsaha');

const { buildInteriorAdvanceState, filterLedgerBySearch, selectLatestOfflineInvoices } = router.__testables;

const penjualan = {
  id: 10,
  nama_customer: 'PT Contoh',
  no_po: 'PO-10',
  faktur: 'FAKTUR',
  pakai_ppn: 0,
  items: [{ qty: 1, subtotal: 1000 }],
};

describe('piutang usaha calculations', () => {
  test('beberapa invoice Offline tetap mewakili satu tagihan penjualan', () => {
    const invoices = [
      { id: 1, penjualan_offline_id: 7, tanggal: '2026-01-01', nomor_invoice: 'INV-LAMA' },
      { id: 2, penjualan_offline_id: 7, tanggal: '2026-02-01', nomor_invoice: 'INV-BARU' },
      { id: 3, penjualan_offline_id: 8, tanggal: '2026-01-15', nomor_invoice: 'INV-LAIN' },
    ];

    const result = selectLatestOfflineInvoices(invoices);

    expect(result).toHaveLength(2);
    expect(result.find(row => row.penjualan_offline_id === 7)?.nomor_invoice).toBe('INV-BARU');
  });

  test('pencarian referensi mempertahankan semua mutasi ledger customer yang cocok', () => {
    const entries = [
      { piutang_key: 'A', referensi: 'INV-001', customer: 'Alpha', debit: 1000, kredit: 0 },
      { piutang_key: 'A', referensi: 'TRANSFER', customer: 'Alpha', debit: 0, kredit: 400 },
      { piutang_key: 'B', referensi: 'INV-002', customer: 'Beta', debit: 500, kredit: 0 },
    ];

    const result = filterLedgerBySearch(entries, 'INV-001');

    expect(result).toHaveLength(2);
    expect(result.reduce((saldo, row) => saldo + row.debit - row.kredit, 0)).toBe(600);
  });

  test('kelebihan pembayaran dialokasikan kronologis sebagai uang muka', async () => {
    const invoices = [
      { id: 1, penjualan_interior_id: 10, tanggal: '2026-02-01', nomor_invoice: 'INV-1', penjualan },
      { id: 2, penjualan_interior_id: 10, tanggal: '2026-04-01', nomor_invoice: 'INV-2', penjualan: { ...penjualan, items: [{ qty: 1, subtotal: 150 }] } },
    ];
    const payments = [
      { id: 1, penjualan_interior_id: 10, tanggal: '2026-01-01', jumlah: 300, tipe: 'DP', penjualan },
      { id: 2, penjualan_interior_id: 10, tanggal: '2026-03-01', jumlah: 900, tipe: 'TERMIN_1', penjualan },
    ];

    const state = await buildInteriorAdvanceState(invoices, payments);
    const row = state.rekapRows[0];

    expect(state.normalPaymentAmounts.get(1)).toBe(0);
    expect(state.normalPaymentAmounts.get(2)).toBe(700);
    expect(state.usageByInvoice.get(1)).toBe(300);
    expect(state.usageByInvoice.get(2)).toBe(150);
    expect(row).toMatchObject({ uang_muka_masuk: 500, uang_muka_terpakai: 450, sisa_uang_muka: 50 });
  });
});
