const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');
require('dayjs/locale/id');
dayjs.locale('id');

// ─── Konfigurasi Perusahaan ───────────────────────────────────────────────────
const COMPANY = {
  name: 'CV.CATUR BHAKTI MANDIRI',
  address1: 'Kawasan Industri BSB, A 3A, 5-6 Jatibarang,',
  address2: 'Mijen, Semarang',
  city: 'Kendal',
  bank_faktur: 'BCA 8715898787 a.n. CATUR BHAKTI MANDIRI',
  bank_non_faktur: 'BCA 8715883488 a.n. EI LIE PURNAMA',
  signer_title: 'Bagian Keuangan',
  signer_name: "Amaroh U'un Setiawan",
};

// ─── Format Rupiah ─────────────────────────────────────────────────────────────
const formatRupiah = (num) =>
  'Rp ' + Number(num || 0).toLocaleString('id-ID', { minimumFractionDigits: 0 });

// ─── Terbilang (Angka → Kata Bahasa Indonesia) ─────────────────────────────────
const terbilang = (num) => {
  const n = Math.floor(Math.abs(num || 0));
  if (n === 0) return 'Nol rupiah';

  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas',
    'tujuh belas', 'delapan belas', 'sembilan belas'];

  const toWords = (x) => {
    if (x === 0) return '';
    if (x < 20) return satuan[x];
    const tens = Math.floor(x / 10);
    const ones = x % 10;
    const tensMap = ['', '', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh',
      'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];
    if (x < 100) return tensMap[tens] + (ones > 0 ? ' ' + satuan[ones] : '');
    if (x < 200) return 'seratus' + (x > 100 ? ' ' + toWords(x - 100) : '');
    if (x < 1000) return toWords(Math.floor(x / 100)) + ' ratus' + (x % 100 > 0 ? ' ' + toWords(x % 100) : '');
    if (x < 2000) return 'seribu' + (x > 1000 ? ' ' + toWords(x - 1000) : '');
    if (x < 1e6) return toWords(Math.floor(x / 1000)) + ' ribu' + (x % 1000 > 0 ? ' ' + toWords(x % 1000) : '');
    if (x < 1e9) return toWords(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 > 0 ? ' ' + toWords(x % 1e6) : '');
    return toWords(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 > 0 ? ' ' + toWords(x % 1e9) : '');
  };

  const words = toWords(n);
  return words.charAt(0).toUpperCase() + words.slice(1) + ' rupiah.';
};

// ─── Gambar Logo Perusahaan (kiri) + Info Perusahaan ─────────────────────────
const drawCompanyHeader = (doc) => {
  // Logo box (placeholder berbentuk seperti aslinya)
  const lx = 40, ly = 28, lw = 50, lh = 46;
  doc.save();
  doc.rect(lx, ly, lw, lh).lineWidth(1.8).stroke('#cc1111');
  // M shape
  doc.moveTo(lx + 7, ly + lh - 10).lineTo(lx + 7, ly + 9)
    .lineTo(lx + lw / 2, ly + lh / 2 - 2)
    .lineTo(lx + lw - 7, ly + 9)
    .lineTo(lx + lw - 7, ly + lh - 10)
    .lineWidth(2.2).stroke('#cc1111');
  doc.restore();

  // Nama & alamat perusahaan
  const tx = lx + lw + 10;
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(COMPANY.name, tx, ly + 3);
  doc.font('Helvetica').fontSize(9).fillColor('#444')
    .text(COMPANY.address1, tx, ly + 20)
    .text(COMPANY.address2, tx, ly + 31);
};

// ─── Header Surat Jalan / Surat Pengantar ─────────────────────────────────────
// Layout: Logo+Company (kiri), Kepada Yth (kanan)
const drawSJHeader = (doc, penjualan) => {
  drawCompanyHeader(doc);

  // Kepada Yth (kanan atas)
  const rx = 305;
  doc.font('Helvetica').fontSize(9).fillColor('#000').text('Kepada  Yth.', rx, 32);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000')
    .text(penjualan.nama_penerima || '-', rx, 43);

  const alamat = penjualan.pengirim_detail || '';
  if (alamat) {
    doc.font('Helvetica').fontSize(8.8).fillColor('#333')
      .text(alamat, rx, 56, { width: 250 });
  }
};

// ─── Helper: gambar tabel header row ─────────────────────────────────────────
const drawTableHeaderRow = (doc, cols, y, h = 22) => {
  cols.forEach(({ x, w, label, align = 'center', multiline = false }) => {
    doc.rect(x, y, w, h).fillAndStroke('#ebebeb', '#999');
    doc.font('Helvetica-Bold').fontSize(8.3).fillColor('#000');
    const ty = multiline ? y + 2 : y + (h - 9) / 2;
    doc.text(label, x + 3, ty, { width: w - 6, align });
  });
  return y + h;
};

// ─── Helper: gambar tabel data row ───────────────────────────────────────────
const drawTableDataRow = (doc, cols, y, cells, rowIdx, h = 28) => {
  const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9f9f9';
  cols.forEach(({ x, w }, i) => {
    doc.rect(x, y, w, h).fillAndStroke(bg, '#ccc');
  });
  doc.font('Helvetica').fontSize(8.5).fillColor('#000');
  cells.forEach(({ col, value, align = 'left', bold = false }) => {
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.text(String(value ?? ''), col.x + 3, y + 5, { width: col.w - 6, align });
  });
  return y + h;
};

// ─────────────────────────────────────────────────────────────────────────────
//  1. SURAT JALAN
// ─────────────────────────────────────────────────────────────────────────────
const generatePDFSuratJalan = (res, data) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="SJ-${data.nomor_surat.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  const penjualan = data.penjualan || {};
  const items = penjualan.items || [];

  // Header
  drawSJHeader(doc, penjualan);

  // Judul
  const titleY = 88;
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#000')
    .text(`SURAT JALAN NO. ${data.nomor_surat}`, 40, titleY);

  // Garis bawah judul
  doc.moveTo(40, titleY + 17).lineTo(555, titleY + 17).lineWidth(0.6).stroke('#aaa');

  // Tabel
  const tY = titleY + 24;
  const colNo  = { x: 40,  w: 28,  label: 'NO' };
  const colKode = { x: 68,  w: 100, label: 'KODE BARANG' };
  const colNama = { x: 168, w: 327, label: 'NAMA BARANG' };
  const colJml  = { x: 495, w: 60,  label: 'JUMLAH' };
  const cols = [colNo, colKode, colNama, colJml];

  let rowY = drawTableHeaderRow(doc, cols, tY, 22);

  items.forEach((item, idx) => {
    const kode = item.barang?.kode || String(item.barang_id || '');
    const nama = item.barang?.nama || '-';
    rowY = drawTableDataRow(doc, cols, rowY, [
      { col: colNo,   value: idx + 1, align: 'center' },
      { col: colKode, value: kode },
      { col: colNama, value: nama },
      { col: colJml,  value: item.qty, align: 'center' },
    ], idx, 28);
  });

  // Keterangan
  const kY = rowY + 12;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
    .text('Keterangan  : ', 40, kY, { continued: !!data.catatan });
  if (data.catatan) {
    doc.font('Helvetica').fillColor('#cc1111').text(data.catatan);
  }

  // Kota & tanggal
  const dateStr = dayjs(data.tanggal).locale('id').format('DD MMMM YYYY');
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`${COMPANY.city}, ${dateStr}`, 40, doc.y + 14);

  // 3 Tanda Tangan
  const sigY = doc.y + 12;
  const cols3 = [40, 210, 400];
  const labels3 = ['Dibuat Oleh :', 'Dibawa Oleh :', 'Diterima Oleh :'];
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  cols3.forEach((x, i) => doc.text(labels3[i], x, sigY));

  const lineY = sigY + 60;
  cols3.forEach((x) => {
    doc.moveTo(x, lineY).lineTo(x + 140, lineY).lineWidth(0.5).stroke('#000');
  });
  doc.font('Helvetica').fontSize(9).fillColor('#000').text('Admin', cols3[0] + 45, lineY + 4);

  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. INVOICE
// ─────────────────────────────────────────────────────────────────────────────
const generatePDFInvoice = (res, data) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="INV-${data.nomor_invoice.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  const penjualan = data.penjualan || {};
  const items = penjualan.items || [];
  const isFaktur = penjualan.faktur === 'FAKTUR';
  const bankInfo = isFaktur ? COMPANY.bank_faktur : COMPANY.bank_non_faktur;

  // Header kiri (company)
  drawCompanyHeader(doc);

  // Nomor & Tanggal (kanan atas)
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`Nomor :  ${data.nomor_invoice}`, 335, 32, { width: 220 })
    .text(`Tanggal :  ${dayjs(data.tanggal).locale('id').format('DD MMMM YYYY')}`, 335, 45, { width: 220 });

  // Judul
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000')
    .text('INVOICE', 0, 76, { align: 'center' });

  // Kepada Yth
  doc.font('Helvetica').fontSize(9.5).fillColor('#000').text('Kepada Yth.', 40, 100);
  doc.font('Helvetica-Bold').fontSize(10).text(penjualan.nama_penerima || '-', 40, 112);

  let addrY = 124;
  const alamat = penjualan.pengirim_detail || '';
  if (alamat) {
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(alamat, 40, addrY, { width: 270 });
    addrY = doc.y + 2;
  }
  if (penjualan.no_npwp) {
    doc.font('Helvetica').fontSize(9).fillColor('#333')
      .text(`NPWP/NIK : ${penjualan.no_npwp}`, 40, addrY);
    addrY = doc.y + 2;
  }

  // Tabel
  const tY = Math.max(doc.y + 10, 172);
  const colNo  = { x: 40,  w: 28,  label: 'NO' };
  const colKode = { x: 68,  w: 100, label: 'KODE BARANG' };
  const colNama = { x: 168, w: 220, label: 'NAMA BARANG' };
  const colQty  = { x: 388, w: 50,  label: 'KUANTITAS' };
  const colHrg  = { x: 438, w: 57,  label: 'HARGA' };
  const colJml  = { x: 495, w: 60,  label: 'JUMLAH' };
  const cols = [colNo, colKode, colNama, colQty, colHrg, colJml];

  let rowY = drawTableHeaderRow(doc, cols, tY, 24);

  let totalAmount = 0;
  items.forEach((item, idx) => {
    const kode = item.barang?.kode || String(item.barang_id || '');
    const nama = item.barang?.nama || '-';
    const subtotal = parseFloat(item.subtotal || 0);
    totalAmount += subtotal;
    rowY = drawTableDataRow(doc, cols, rowY, [
      { col: colNo,   value: idx + 1, align: 'center' },
      { col: colKode, value: kode },
      { col: colNama, value: nama },
      { col: colQty,  value: item.qty, align: 'center' },
      { col: colHrg,  value: formatRupiah(item.harga_satuan), align: 'right' },
      { col: colJml,  value: formatRupiah(subtotal), align: 'right' },
    ], idx);
  });

  // Baris Total Invoice
  const totalH = 22;
  const spanW = colNo.w + colKode.w + colNama.w + colQty.w + colHrg.w;
  doc.rect(colNo.x, rowY, spanW, totalH).fillAndStroke('#ebebeb', '#999');
  doc.rect(colJml.x, rowY, colJml.w, totalH).fillAndStroke('#ebebeb', '#999');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
    .text('TOTAL INVOICE', colNo.x + 3, rowY + 6, { width: spanW - 6 })
    .text(formatRupiah(totalAmount), colJml.x + 3, rowY + 6, { width: colJml.w - 6, align: 'right' });
  rowY += totalH;

  // Info: Terbilang, PO, Surat Jalan, Jatuh Tempo
  const infoY = rowY + 14;
  const sjNomors = (penjualan.suratJalans || []).map(sj => sj.nomor_surat).join(', ') || '-';

  const infoRows = [
    { label: 'Terbilang', value: `: ${terbilang(totalAmount)}` },
    { label: 'PO', value: `: ${penjualan.no_po || '-'}` },
    { label: 'Surat Jalan', value: `: ${sjNomors}` },
    { label: 'Jatuh Tempo', value: `: ${data.catatan || '-'}` },
  ];

  doc.font('Helvetica').fontSize(9).fillColor('#000');
  infoRows.forEach((row, i) => {
    const iy = infoY + i * 16;
    doc.text(row.label, 40, iy, { width: 80 });
    doc.text(row.value, 120, iy, { width: 380 });
  });

  // Tanda tangan & kotak bank
  const sigBaseY = infoY + infoRows.length * 16 + 18;

  // Kotak rekening bank (kiri bawah) — dashed rose
  const bx = 40, by = sigBaseY + 28, bw = 235, bh = 46;
  doc.rect(bx, by, bw, bh).dash(4, { space: 3 }).lineWidth(1).stroke('#cc1111');
  doc.undash();
  doc.font('Helvetica').fontSize(8.5).fillColor('#333')
    .text('Pembayaran mohon dapat ditransfer ke rekening:', bx + 8, by + 9, { width: bw - 16 });
  doc.font('Helvetica-Bold').fontSize(9.3).fillColor('#cc1111')
    .text(bankInfo, bx + 8, by + 22, { width: bw - 16 });

  // Tanda tangan (kanan)
  const sigRX = 395;
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(COMPANY.signer_title, sigRX, sigBaseY + 10, { width: 160, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9.5)
    .text(COMPANY.signer_name, sigRX, sigBaseY + 62, { width: 160, align: 'center' });

  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. SURAT PENGANTAR
// ─────────────────────────────────────────────────────────────────────────────
const generatePDFSuratPengantar = (res, data) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="SP-${data.nomor_sp.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  const penjualan = data.penjualan || {};
  const items = penjualan.items || [];

  // Header (sama persis dengan Surat Jalan)
  drawSJHeader(doc, penjualan);

  // Judul
  const titleY = 88;
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#000')
    .text(`SURAT PENGANTAR NO. ${data.nomor_sp}`, 40, titleY);

  doc.moveTo(40, titleY + 17).lineTo(555, titleY + 17).lineWidth(0.6).stroke('#aaa');

  // Tabel (sama dengan SJ, tanpa harga)
  const tY = titleY + 24;
  const colNo  = { x: 40,  w: 28,  label: 'NO' };
  const colKode = { x: 68,  w: 100, label: 'KODE BARANG' };
  const colNama = { x: 168, w: 327, label: 'NAMA BARANG' };
  const colJml  = { x: 495, w: 60,  label: 'JUMLAH' };
  const cols = [colNo, colKode, colNama, colJml];

  let rowY = drawTableHeaderRow(doc, cols, tY, 22);

  items.forEach((item, idx) => {
    const kode = item.barang?.kode || String(item.barang_id || '');
    const nama = item.barang?.nama || '-';
    rowY = drawTableDataRow(doc, cols, rowY, [
      { col: colNo,   value: idx + 1, align: 'center' },
      { col: colKode, value: kode },
      { col: colNama, value: nama },
      { col: colJml,  value: item.qty, align: 'center' },
    ], idx, 28);
  });

  // Keterangan
  const kY = rowY + 12;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
    .text('Keterangan  : ', 40, kY, { continued: !!data.catatan });
  if (data.catatan) {
    doc.font('Helvetica').fillColor('#cc1111').text(data.catatan);
  }

  // Kota & tanggal
  const dateStr = dayjs(data.tanggal).locale('id').format('DD MMMM YYYY');
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`${COMPANY.city}, ${dateStr}`, 40, doc.y + 14);

  // 3 Tanda Tangan
  const sigY = doc.y + 12;
  const cols3 = [40, 210, 400];
  const labels3 = ['Dibuat Oleh :', 'Dibawa Oleh :', 'Diterima Oleh :'];
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  cols3.forEach((x, i) => doc.text(labels3[i], x, sigY));

  const lineY = sigY + 60;
  cols3.forEach((x) => {
    doc.moveTo(x, lineY).lineTo(x + 140, lineY).lineWidth(0.5).stroke('#000');
  });
  doc.font('Helvetica').fontSize(9).fillColor('#000').text('Admin', cols3[0] + 45, lineY + 4);

  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. PROFORMA INVOICE (Interior)
// ─────────────────────────────────────────────────────────────────────────────
const generatePDFProforma = (res, data) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="PRF-${data.nomor_proforma.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  const penjualan = data.penjualan || {};
  const items = penjualan.items || [];
  const isFaktur = penjualan.faktur === 'FAKTUR';
  const bankInfo = isFaktur ? COMPANY.bank_faktur : COMPANY.bank_non_faktur;

  // Header
  drawCompanyHeader(doc);

  // Nomor & Tanggal (kanan atas)
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`Nomor :  ${data.nomor_proforma}`, 335, 32, { width: 220 })
    .text(`Tanggal :  ${dayjs(data.tanggal).locale('id').format('DD MMMM YYYY')}`, 335, 45, { width: 220 });

  // Judul
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000')
    .text('PROFORMA INVOICE', 0, 76, { align: 'center' });

  // Kepada Yth
  doc.font('Helvetica').fontSize(9.5).fillColor('#000').text('Kepada Yth.', 40, 100);
  doc.font('Helvetica-Bold').fontSize(10).text(penjualan.nama_customer || '-', 40, 112);

  let addrY = 124;
  if (penjualan.nama_pt_npwp) {
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(penjualan.nama_pt_npwp, 40, addrY);
    addrY = doc.y + 2;
  }
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`No. HP: ${penjualan.no_hp || '-'}`, 40, addrY);
  if (penjualan.no_npwp) {
    doc.text(`NPWP: ${penjualan.no_npwp}`, 40, doc.y + 2);
  }
  if (penjualan.no_po) {
    doc.text(`No. PO: ${penjualan.no_po}`, 40, doc.y + 2);
  }

  // Tabel
  const tY = Math.max(doc.y + 10, 180);
  const colNo  = { x: 40,  w: 28,  label: 'NO' };
  const colKode = { x: 68,  w: 90,  label: 'KODE\nBARANG', multiline: true };
  const colNama = { x: 158, w: 230, label: 'NAMA BARANG' };
  const colQty  = { x: 388, w: 45,  label: 'QTY' };
  const colHrg  = { x: 433, w: 62,  label: 'HARGA\nSATUAN', multiline: true };
  const colJml  = { x: 495, w: 60,  label: 'JUMLAH' };
  const cols = [colNo, colKode, colNama, colQty, colHrg, colJml];

  let rowY = drawTableHeaderRow(doc, cols, tY, 24);

  let subtotalTotal = 0;
  items.forEach((item, idx) => {
    const kode = item.kode_barang || String(item.barang_id || '');
    const nama = item.nama_barang || '-';
    const subtotal = parseFloat(item.subtotal || 0);
    subtotalTotal += subtotal;
    rowY = drawTableDataRow(doc, cols, rowY, [
      { col: colNo,   value: idx + 1, align: 'center' },
      { col: colKode, value: kode },
      { col: colNama, value: nama },
      { col: colQty,  value: item.qty, align: 'center' },
      { col: colHrg,  value: formatRupiah(item.harga_satuan), align: 'right' },
      { col: colJml,  value: formatRupiah(subtotal), align: 'right' },
    ], idx);
  });

  // Subtotal
  const subH = 20;
  const spanW = colNo.w + colKode.w + colNama.w + colQty.w + colHrg.w;
  let runningTotal = subtotalTotal;

  doc.rect(colNo.x, rowY, spanW, subH).fillAndStroke('#f9f9f9', '#ccc');
  doc.rect(colJml.x, rowY, colJml.w, subH).fillAndStroke('#f9f9f9', '#ccc');
  doc.font('Helvetica').fontSize(9).fillColor('#000')
    .text('Subtotal', colNo.x + 3, rowY + 5, { width: spanW - 6, align: 'right' })
    .text(formatRupiah(subtotalTotal), colJml.x + 3, rowY + 5, { width: colJml.w - 6, align: 'right' });
  rowY += subH;

  // PPN (jika ada)
  if (penjualan.pakai_ppn && penjualan.ppn_persen) {
    const ppnPct = parseInt(penjualan.ppn_persen);
    const ppnVal = subtotalTotal * (ppnPct / 100);
    runningTotal = subtotalTotal + ppnVal;

    doc.rect(colNo.x, rowY, spanW, subH).fillAndStroke('#f9f9f9', '#ccc');
    doc.rect(colJml.x, rowY, colJml.w, subH).fillAndStroke('#f9f9f9', '#ccc');
    doc.font('Helvetica').fontSize(9).fillColor('#000')
      .text(`PPN ${ppnPct}%`, colNo.x + 3, rowY + 5, { width: spanW - 6, align: 'right' })
      .text(formatRupiah(ppnVal), colJml.x + 3, rowY + 5, { width: colJml.w - 6, align: 'right' });
    rowY += subH;
  }

  // Total
  doc.rect(colNo.x, rowY, spanW, subH + 2).fillAndStroke('#ebebeb', '#999');
  doc.rect(colJml.x, rowY, colJml.w, subH + 2).fillAndStroke('#ebebeb', '#999');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
    .text('TOTAL', colNo.x + 3, rowY + 6, { width: spanW - 6, align: 'right' })
    .text(formatRupiah(data.total || runningTotal), colJml.x + 3, rowY + 6, { width: colJml.w - 6, align: 'right' });
  rowY += subH + 2;

  // Terbilang
  const tbY = rowY + 12;
  doc.font('Helvetica').fontSize(9).fillColor('#000')
    .text('Terbilang', 40, tbY, { width: 80 })
    .text(`: ${terbilang(data.total || runningTotal)}`, 120, tbY, { width: 390 });

  if (data.catatan) {
    doc.font('Helvetica').fontSize(9).fillColor('#000')
      .text('Catatan', 40, doc.y + 4, { width: 80 })
      .text(`: ${data.catatan}`, 120, doc.y, { width: 390 });
  }

  // Tanda tangan & kotak bank
  const sigBaseY = doc.y + 22;

  // Kotak rekening bank
  const bx = 40, by = sigBaseY + 28, bw = 235, bh = 46;
  doc.rect(bx, by, bw, bh).dash(4, { space: 3 }).lineWidth(1).stroke('#cc1111');
  doc.undash();
  doc.font('Helvetica').fontSize(8.5).fillColor('#333')
    .text('Pembayaran mohon dapat ditransfer ke rekening:', bx + 8, by + 9, { width: bw - 16 });
  doc.font('Helvetica-Bold').fontSize(9.3).fillColor('#cc1111')
    .text(bankInfo, bx + 8, by + 22, { width: bw - 16 });

  // Tanda tangan (kanan)
  const sigRX = 395;
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(COMPANY.signer_title, sigRX, sigBaseY + 10, { width: 160, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9.5)
    .text(COMPANY.signer_name, sigRX, sigBaseY + 62, { width: 160, align: 'center' });

  doc.end();
};

module.exports = {
  generatePDFSuratJalan,
  generatePDFInvoice,
  generatePDFSuratPengantar,
  generatePDFProforma,
};
