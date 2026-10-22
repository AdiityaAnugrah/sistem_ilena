const { buildEffectiveInteriorInvoices } = require('../interiorReceivables');
const sale = { id: 42, faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11, items: [{ qty: 1, subtotal: 78300000 }] };
const sub = (id, date, tipe, persen, penjualan = sale) => ({ id, tanggal: date, penjualan_interior_id: penjualan.id, penjualan, nomor_sub_invoice: `SUB-${id}`, terms: JSON.stringify([{ tipe, persen }]) });
const amount = async inv => ({ subtotal: inv.total, ppn: 0, total: inv.total });
const sum = docs => docs.reduce((s,d) => s + d._ledgerAmount.total, 0);
describe('tagihan efektif Interior dari invoice dan Sub-Invoice', () => {
  test('DP Bun Sun memakai nominal 30%, bukan total proyek', async () => {
    const p = { id: 83, faktur: 'NON_FAKTUR', items: [{ qty: 1, subtotal: 21487916 }] };
    const docs = await buildEffectiveInteriorInvoices([], [sub(102, '2026-10-03', 'DP', 30, p)], amount);
    expect(sum(docs)).toBe(6446375);
    expect(docs[0].ledgerKey).toBe('SUB-102');
  });
  test('tiga termin berbeda 30+65+5 dihitung sekali masing-masing', async () => {
    const docs = await buildEffectiveInteriorInvoices([], [sub(51,'2025-12-01','DP',30),sub(60,'2026-03-06','TERMIN_1',65),sub(67,'2026-04-23','PELUNASAN_AKHIR',5)], amount);
    expect(docs.map(d=>d._ledgerAmount.total)).toEqual([26073900,56493450,4345650]);
    expect(sum(docs)).toBe(86913000);
  });
  test('Sub-Invoice berulang untuk termin sama tidak melipatgandakan tagihan', async () => {
    expect(sum(await buildEffectiveInteriorInvoices([], [sub(1,'2026-01-01','DP',30),sub(2,'2026-02-01','DP',30)], amount))).toBe(26073900);
  });
  test('pelunasan penuh tidak menambah 100% di atas DP', async () => {
    expect(sum(await buildEffectiveInteriorInvoices([], [sub(1,'2026-01-01','DP',30),sub(2,'2026-02-01','PELUNASAN_PENUH',100)], amount))).toBe(86913000);
  });
  test.each([['2026-01-01','2026-02-01'],['2026-02-01','2026-01-01']])('invoice pengiriman dan termin yang sama tidak dihitung ganda (%s)', async (invoiceDate, subDate) => {
    const inv={id:1,tanggal:invoiceDate,penjualan_interior_id:42,penjualan:sale,total:86913000};
    expect(sum(await buildEffectiveInteriorInvoices([inv],[sub(1,subDate,'DP',30)],amount))).toBe(86913000);
  });
  test('pengiriman parsial hanya menambah bagian belum ditagih', async () => {
    const inv=[{id:1,tanggal:'2026-02-01',penjualan_interior_id:42,penjualan:sale,total:40000000},{id:2,tanggal:'2026-03-01',penjualan_interior_id:42,penjualan:sale,total:46913000}];
    const docs=await buildEffectiveInteriorInvoices(inv,[sub(1,'2026-01-01','DP',30)],amount);
    expect(docs.map(d=>d._ledgerAmount.total)).toEqual([26073900,13926100,46913000]);
  });
  test('Proforma tanpa nomor atau tanpa terms valid bukan debit invoice', async () => {
    expect(await buildEffectiveInteriorInvoices([], [{...sub(1,'2026-01-01','DP',30),nomor_sub_invoice:null},{...sub(2,'2026-01-01','DP',30),terms:'invalid'}],amount)).toEqual([]);
  });
  test('ID sama dari dua tabel tetap mempunyai ledgerKey berbeda', async () => {
    const inv={id:1,tanggal:'2026-02-01',penjualan_interior_id:42,penjualan:sale,total:86913000};
    const docs=await buildEffectiveInteriorInvoices([inv],[sub(1,'2026-01-01','DP',30)],amount);
    expect(docs.map(d=>d.ledgerKey)).toEqual(['SUB-1',1]);
  });
});
