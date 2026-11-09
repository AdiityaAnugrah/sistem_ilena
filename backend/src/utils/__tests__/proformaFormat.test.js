const { generateHTMLProforma } = require('../htmlGenerator');

const sale = {
  faktur: 'FAKTUR', pakai_ppn: 1, ppn_persen: 11,
  items: [{ kode_barang: 'KD-AK-REST25-MOLA', nama_barang: 'SANDAR LID REST (25 CM)', qty: 3, harga_satuan: 10005, subtotal: 30015 }],
};
const doc = { tanggal: '2026-11-07', nomor_proforma: 'PRO-FIXTURE', nomor_invoice: 'INV-FIXTURE', nomor_sub_invoice: 'SUB-FIXTURE', terms: '[{"tipe":"DP","persen":30}]', penjualan: sale };
const header = html => [...html.match(/<thead>([\s\S]*?)<\/thead>/)[1].matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map(match => match[1]);
const firstRow = html => html.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/)[1];

describe('Interior Proforma product table', () => {
  test('uses requested six-column order', () => {
    expect(header(generateHTMLProforma(doc))).toEqual(['NO', 'NAMA BARANG', 'KUANTITAS', 'HARGA SATUAN', 'PPN', 'JUMLAH']);
  });
  test('places unchanged product code below name in a smaller font in the same cell', () => {
    const cells = [...firstRow(generateHTMLProforma(doc)).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
    expect(cells).toHaveLength(6);
    expect(cells[1][1]).toMatch(/SANDAR LID REST \(25 CM\)[\s\S]*font-size:9px[\s\S]*KD-AK-REST25-MOLA/);
  });
  test('shows line VAT and inclusive amount without changing project total', () => {
    const html = generateHTMLProforma(doc);
    const row = firstRow(html);
    expect(row).toContain('3.303');
    expect(row).toContain('33.318');
    expect(html).toContain('30.015');
    expect(html).toMatch(/>JUMLAH<\/td>\s*<td[^>]*>Rp 33\.318<\/td>/);
  });
  test('VAT-disabled row explicitly shows zero tax and base amount', () => {
    const row = firstRow(generateHTMLProforma({ ...doc, penjualan: { ...sale, pakai_ppn: 0 } }));
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
    expect(cells[4][1]).toBe('Rp 0');
    expect(cells[5][1]).toBe('Rp 30.015');
  });
  test('escapes names/codes and keeps missing-code placeholder', () => {
    const html = generateHTMLProforma({ ...doc, penjualan: { ...sale, items: [{ ...sale.items[0], nama_barang: '<b>Nama</b>', kode_barang: '<script>x</script>' }] } });
    expect(firstRow(html)).toContain('&lt;B&gt;NAMA&lt;/B&gt;');
    expect(firstRow(html)).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(firstRow(html)).not.toContain('<script>');
    expect(firstRow(generateHTMLProforma({ ...doc, penjualan: { ...sale, items: [{ ...sale.items[0], kode_barang: null }] } }))).toContain('margin-top:2px;">-</div>');
  });
  test('keeps optional charges visible only when filled', () => {
    expect(generateHTMLProforma(doc)).not.toContain('BIAYA ASSEMBLY');
    expect(generateHTMLProforma({ ...doc, penjualan: { ...sale, biaya_assembly: 100000 } })).toContain('BIAYA ASSEMBLY');
  });
});


describe('Non-faktur Proforma column visibility', () => {
  const render = overrides => generateHTMLProforma({ ...doc, ...overrides,
    penjualan: { ...sale, faktur: 'NON FAKTUR', pakai_ppn: 0, biaya_assembly: 100000, biaya_kirim: 200000,
      pembayarans: [{ tipe: 'DP', jumlah: 10000, tanggal: '2026-11-09' }] } });
  test('hides only PPN and preserves product code and base amount', () => {
    const html = render();
    expect(header(html)).toEqual(['NO', 'NAMA BARANG', 'KUANTITAS', 'HARGA SATUAN', 'JUMLAH']);
    const cells = [...firstRow(html).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
    expect(cells).toHaveLength(5);
    expect(cells[1][1]).toContain('KD-AK-REST25-MOLA');
    expect(cells[3][1]).toBe('Rp 10.005');
    expect(cells[4][1]).toBe('Rp 30.015');
    expect(html).toContain('Rp 330.015');
  });
  test('aligns every summary, fee, paid/unpaid term and balance row to five columns', () => {
    const html = render({ terms: JSON.stringify([{ tipe: 'DP', jumlah: 10000 }, { tipe: 'TERMIN_1', jumlah: 20000 }]) });
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    const rows = [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)];
    expect(rows.length).toBeGreaterThan(6);
    for (const [, row] of rows) {
      const width = [...row.matchAll(/<td\b([^>]*)>/g)].reduce((n, cell) => n + Number(cell[1].match(/colspan="(\d+)"/)?.[1] || 1), 0);
      expect(width).toBe(5);
    }
    expect(tbody).toContain('BIAYA ASSEMBLY');
    expect(tbody).toContain('BIAYA KIRIM');
    expect(tbody).toContain('belum terbayar');
    expect(tbody).toContain('terbayar tanggal');
    expect(tbody).toContain('SISA');
  });
});
