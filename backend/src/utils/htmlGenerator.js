const dayjs = require('dayjs');
require('dayjs/locale/id');
dayjs.locale('id');

// ─── Shared toolbar & signature helpers ────────────────────────────────────

const TOOLBAR_CSS = `
    .doc-toolbar {
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 9999;
        background: #1e293b;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .doc-toolbar .tb-sep { flex: 1; }
    .tb-btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        font-family: inherit;
        transition: opacity 0.15s;
    }
    .tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .tb-btn-ghost { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
    .tb-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.14); }
    .tb-btn-primary { background: #2563eb; color: #fff; }
    .tb-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .tb-label-btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.85);
        font-family: inherit;
        transition: background 0.15s;
    }
    .tb-label-btn:hover { background: rgba(255,255,255,0.14); }
    .tb-status { font-size: 11px; color: rgba(255,255,255,0.45); margin-left: 4px; }
    .sig-overlay {
        position: absolute;
        display: none;
        z-index: 1000;
        cursor: move;
        user-select: none;
    }
    .sig-overlay img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .sig-resize-handle {
        position: absolute;
        bottom: 0; right: 0;
        width: 14px; height: 14px;
        background: #3b82f6;
        cursor: se-resize;
        border-radius: 3px 0 3px 0;
    }
    .sig-delete-btn {
        position: absolute;
        top: -9px; right: -9px;
        width: 18px; height: 18px;
        background: #ef4444;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        font-size: 12px;
        line-height: 1;
        font-weight: 700;
    }
    body { padding-top: 46px; }
    @media print {
        .doc-toolbar { display: none !important; }
        body { padding-top: 0 !important; }
        .sig-delete-btn { display: none !important; }
        .sig-resize-handle { display: none !important; }
    }
`;

const TOOLBAR_HTML_FULL = `
<div class="doc-toolbar" id="docToolbar">
    <label class="tb-label-btn" id="tbUploadLabel" title="Upload tanda tangan">
        &#128247; Upload TTD
        <input type="file" id="inputSignature" accept="image/*" style="display:none">
    </label>
    <button class="tb-btn tb-btn-ghost" id="btnAddSig" disabled>+ Tambah ke Dokumen</button>
    <span class="tb-status" id="tbStatus"></span>
    <div class="tb-sep"></div>
    <button class="tb-btn tb-btn-ghost" id="btnPrint">&#128424; Cetak</button>
    <button class="tb-btn tb-btn-primary" id="btnSavePDF">&#11015; Simpan PDF</button>
</div>
`;

const TOOLBAR_HTML_SIMPLE = `
<div class="doc-toolbar" id="docToolbar">
    <div class="tb-sep"></div>
    <button class="tb-btn tb-btn-ghost" id="btnPrint">&#128424; Cetak</button>
    <button class="tb-btn tb-btn-primary" id="btnSavePDF">&#11015; Simpan PDF</button>
</div>
`;

const SIG_OVERLAY_HTML = `
<div class="sig-overlay" id="sigOverlay">
    <img id="sigImg" src="" alt="Tanda Tangan">
    <div class="sig-delete-btn" id="sigDeleteBtn">&#215;</div>
    <div class="sig-resize-handle" id="sigResizeHandle"></div>
</div>
`;

const buildFullToolbarJS = (pdfFilename) => `
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
(function() {
    var token = new URLSearchParams(window.location.search).get('token') || '';
    var apiBase = window.location.origin;
    var overlay = document.getElementById('sigOverlay');
    var sigImg = document.getElementById('sigImg');
    var btnAddSig = document.getElementById('btnAddSig');
    var tbStatus = document.getElementById('tbStatus');

    function loadSignature() {
        fetch(apiBase + '/api/settings/signature?token=' + token)
            .then(function(r) {
                if (r.ok) {
                    sigImg.src = apiBase + '/api/settings/signature?token=' + token + '&t=' + Date.now();
                    btnAddSig.disabled = false;
                    tbStatus.textContent = 'TTD tersedia';
                } else {
                    tbStatus.textContent = 'Belum ada TTD';
                }
            })
            .catch(function() { tbStatus.textContent = 'Gagal memuat TTD'; });
    }
    loadSignature();

    document.getElementById('inputSignature').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        tbStatus.textContent = 'Mengupload...';
        var fd = new FormData();
        fd.append('signature', file);
        fetch(apiBase + '/api/settings/signature', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: fd,
        })
        .then(function(r) { return r.json(); })
        .then(function() {
            tbStatus.textContent = 'TTD disimpan';
            sigImg.src = apiBase + '/api/settings/signature?token=' + token + '&t=' + Date.now();
            btnAddSig.disabled = false;
        })
        .catch(function() { tbStatus.textContent = 'Upload gagal'; });
    });

    btnAddSig.addEventListener('click', function() {
        overlay.style.display = 'block';
        overlay.style.left = '30mm';
        overlay.style.top = '200mm';
        overlay.style.width = '120px';
        overlay.style.height = '70px';
    });

    document.getElementById('sigDeleteBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        overlay.style.display = 'none';
    });

    var mode = null;
    var startX, startY, startW, startH, startL, startT;
    overlay.addEventListener('mousedown', function(e) {
        if (e.target === document.getElementById('sigResizeHandle')) {
            mode = 'resize';
            startX = e.clientX; startY = e.clientY;
            startW = overlay.offsetWidth; startH = overlay.offsetHeight;
        } else if (e.target !== document.getElementById('sigDeleteBtn')) {
            mode = 'drag';
            startX = e.clientX; startY = e.clientY;
            startL = overlay.offsetLeft; startT = overlay.offsetTop;
        }
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!mode) return;
        if (mode === 'drag') {
            overlay.style.left = (startL + e.clientX - startX) + 'px';
            overlay.style.top = (startT + e.clientY - startY) + 'px';
        } else {
            overlay.style.width = Math.max(40, startW + e.clientX - startX) + 'px';
            overlay.style.height = Math.max(24, startH + e.clientY - startY) + 'px';
        }
    });
    document.addEventListener('mouseup', function() { mode = null; });

    document.getElementById('btnPrint').addEventListener('click', function() { window.print(); });

    document.getElementById('btnSavePDF').addEventListener('click', function() {
        var toolbar = document.getElementById('docToolbar');
        var deleteBtns = document.querySelectorAll('.sig-delete-btn');
        var resizeHandles = document.querySelectorAll('.sig-resize-handle');
        toolbar.style.display = 'none';
        deleteBtns.forEach(function(el) { el.style.display = 'none'; });
        resizeHandles.forEach(function(el) { el.style.display = 'none'; });
        html2pdf()
            .from(document.querySelector('.page'))
            .set({
                margin: 0,
                filename: '${pdfFilename}',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            })
            .save()
            .then(function() {
                toolbar.style.display = '';
                deleteBtns.forEach(function(el) { el.style.display = ''; });
                resizeHandles.forEach(function(el) { el.style.display = ''; });
            });
    });
})();
</script>
`;

const buildSimpleToolbarJS = (pdfFilename) => `
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
(function() {
    document.getElementById('btnPrint').addEventListener('click', function() { window.print(); });
    document.getElementById('btnSavePDF').addEventListener('click', function() {
        var toolbar = document.getElementById('docToolbar');
        toolbar.style.display = 'none';
        html2pdf()
            .from(document.querySelector('.page'))
            .set({
                margin: 0,
                filename: '${pdfFilename}',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            })
            .save()
            .then(function() { toolbar.style.display = ''; });
    });
})();
</script>
`;
// ───────────────────────────────────────────────────────────────────────────

const formatRupiah = (num) =>
  'Rp ' + Number(num || 0).toLocaleString('id-ID', { minimumFractionDigits: 0 });

const toTitleCase = (str) =>
  str ? str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

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

const generateHTMLSuratJalan = (sj) => {
  const penjualan = sj.penjualan || {};
  const items = penjualan.items || [];
  
  // Tanggal format: Kendal, 10 Maret 2026
  const tanggalFormat = dayjs(sj.tanggal).format('DD MMMM YYYY');

  // Helper parse dimensi dari field deskripsi (JSON)
  const parseDimensi = (deskripsi) => {
    try {
      const parsed = typeof deskripsi === 'string' ? JSON.parse(deskripsi) : deskripsi;
      const d = parsed?.dimensi?.asli;
      if (d && d.panjang && d.lebar && d.tinggi) {
        return `${d.panjang} x ${d.lebar} x ${d.tinggi} cm`;
      }
    } catch { /* ignored */ }
    return null;
  };

  // Rows for items
  const itemRows = items.map((item, index) => {
    const baseId = item.barang?.id || item.barang_id;
    const kode = item.varian_id ? `${baseId}${item.varian_id}` : baseId;
    const namaDasar = (item.barang?.nama || '-').toUpperCase();
    const warnaHtml = item.varian_nama?.trim()
      ? `<span style="font-size:10px; color:var(--muted); font-style:italic;">(${item.varian_nama.trim().toUpperCase()})</span>`
      : '';
    const dimensiStr = parseDimensi(item.barang?.deskripsi);
    const dimensiHtml = dimensiStr
      ? `<p class="m-0" style="font-size:10.6px; color:var(--muted);">${dimensiStr}</p>`
      : '';

    return `
      <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-center">${kode}</td>
          <td>
              <p class="m-0" style="font-size:10.9px; font-weight:500;">
                  ${namaDasar} ${warnaHtml}
              </p>
              ${dimensiHtml}
          </td>
          <td class="text-center">${item.qty}</td>
      </tr>
    `;
  }).join('');

  const catatanHTML = sj.catatan ? `
      <p class="m-0 mt-3">
          <b style="font-weight:600;">Keterangan : </b>
          <span class="text-danger">
              ${sj.catatan.replace(/\n/g, '<br>')}
          </span>
      </p>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
    <title>Surat Jalan - ${sj.nomor_surat} | Ilena Furniture</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">

    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

    <style>
    :root {
        --ink: #0f172a;
        --muted: #4b5563;
        --line: #e5e7eb;
        --line2: #f3f4f6;
    }

    html, body {
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background: #fff;
    }

    * {
        font-size: 12px;
        line-height: 1.35;
    }

    h5 {
        font-size: 14.25px;
        font-weight: 600;
        margin: 0;
        letter-spacing: -.15px;
    }

    .subhead {
        font-size: 11px;
        color: var(--muted);
        font-weight: 500;
        margin: 0;
    }

    .title-doc {
        font-size: 13.25px;
        font-weight: 600;
        letter-spacing: .02em;
    }

    .divider {
        height: 1px;
        background: var(--line);
        margin: .4rem 0 .8rem;
    }

    .table { border-color: var(--line); margin-bottom: 0.5rem; }

    .table thead th {
        background: #fbfbfd !important;
        border-bottom: 1px solid var(--line);
        font-weight: 600;
        color: #0f172a;
        font-size: 10.25px;
        vertical-align: middle;
        padding: .40rem .55rem;
        letter-spacing: .02em;
        text-transform: uppercase;
    }

    .table tbody td {
        border-color: var(--line2);
        vertical-align: middle;
        font-size: 10.9px;
        padding: .42rem .55rem;
    }

    .table-striped>tbody>tr:nth-of-type(odd)>* {
        --bs-table-accent-bg: #fcfdff;
    }

    .to-name {
        font-weight: 600;
        font-size: 13px;
    }

    body { background: #e8eaed; }
    .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 14mm;
        background: #fff;
        box-shadow: 0 1px 8px rgba(0,0,0,0.12);
        position: relative;
    }

    .sig-title, .sig-name {
        font-weight: 600;
    }

    /* ========================= */
    /* TANDA TANGAN (FIX SEJAJAR) */
    /* ========================= */
    .sig-row {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: flex-start;
        margin-top: 1rem;
    }

    .sig-box {
        min-width: 180px;
        text-align: center;
    }

    .sig-body {
        height: 86px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
    }

    .sig-body::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
            radial-gradient(circle at 18% 35%, rgba(0, 0, 0, .025), transparent 58%),
            radial-gradient(circle at 72% 65%, rgba(0, 0, 0, .018), transparent 60%),
            radial-gradient(circle at 45% 82%, rgba(0, 0, 0, .012), transparent 55%);
        opacity: .55;
    }

    .sig-stamp, .sig-stamp-rough {
        width: 112px;
        height: auto;
        display: block;
        object-fit: contain;
        pointer-events: none;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(.98);
        background: transparent;
        mix-blend-mode: multiply;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .sig-stamp {
        z-index: 1;
        opacity: .62;
        filter: contrast(1.65) saturate(1.10) brightness(.90) blur(.06px) drop-shadow(0 .20px .25px rgba(0, 0, 0, .10)) drop-shadow(0 1.1px 1.4px rgba(0, 0, 0, .06));
    }

    .sig-stamp-rough {
        z-index: 2;
        opacity: .20;
        transform: translate(-50%, -50%) scale(1.01);
        filter: blur(.34px) contrast(1.20) brightness(.92);
    }

    .sig-footer {
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        line-height: 1;
        margin-top: 2px;
    }

    .sig-line {
        font-weight: 600;
        letter-spacing: .02em;
        margin: 0;
    }

    @page { size: A4 portrait; margin: 0; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; min-height: 0 !important; padding: 14mm !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    ${TOOLBAR_CSS}
    </style>
</head>
<body>
    ${TOOLBAR_HTML_FULL}
    <div class="page">
        ${SIG_OVERLAY_HTML}
        <!-- Header -->
        <div class="d-flex justify-content-between my-4">
            <div style="flex:1;" class="d-flex align-items-between gap-2">
                <div class="d-flex gap-4 justify-content-start">
                    <div>
                        <img src="https://ilenafurniture.com/img/logo/logo-invoice.jpg" alt="Logo" width="70" height="40">
                    </div>
                    <div class="d-flex flex-column justify-content-center gap-1">
                        <h5>CV.CATUR BHAKTI MANDIRI</h5>
                        <p class="subhead">Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="d-flex justify-content-between align-items-end mb-4">
            <div style="flex:1">
                <p class="m-0 title-doc">SURAT JALAN NO. ${sj.nomor_surat}</p>
                <div class="divider"></div>
            </div>

            <div style="flex:1" class="ms-5">
                <p class="m-0" style="font-weight:500;">Kepada Yth.</p>
                <p class="m-0 to-name">${penjualan.nama_penerima || '-'}</p>
                <p class="m-0 mt-1">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}</p>
            </div>
        </div>

        <!-- Tabel -->
        <div class="table-responsive mt-2">
            <table class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 40px;">NO</th>
                        <th class="text-center" style="width: 140px;">KODE BARANG</th>
                        <th class="text-center">NAMA BARANG</th>
                        <th class="text-center" style="width: 90px;">JUMLAH</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>

            ${catatanHTML}

            <p class="mt-4" style="font-weight:500;">Kendal, ${tanggalFormat}</p>

            <!-- Tanda Tangan -->
            <div class="sig-row">
                <!-- Dibuat -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibuat Oleh :</p>
                    <div class="sig-body">
                        <img src="https://ilenafurniture.com/img/logo/stampelfix.png" alt="Stempel" class="sig-stamp">
                        <img src="https://ilenafurniture.com/img/logo/stampelfix.png" alt="" class="sig-stamp-rough">
                    </div>
                    <div class="sig-footer">Admin</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>

                <!-- Dibawa -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibawa Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>

                <!-- Diterima -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Diterima Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>
            </div>
        </div>
    </div>
    ${buildFullToolbarJS(`surat-jalan-${sj.nomor_surat || 'dokumen'}.pdf`)}
</body>
</html>
  `;
};

const generateHTMLSuratPengantar = (sp) => {
  const penjualan = sp.penjualan || {};
  const items = penjualan.items || [];
  
  const tanggalFormat = dayjs(sp.tanggal).format('DD MMMM YYYY');

  const parseDimensiSP = (deskripsi) => {
    try {
      const parsed = typeof deskripsi === 'string' ? JSON.parse(deskripsi) : deskripsi;
      const d = parsed?.dimensi?.asli;
      if (d && d.panjang && d.lebar && d.tinggi) return `${d.panjang} x ${d.lebar} x ${d.tinggi} cm`;
    } catch { /* ignored */ }
    return null;
  };

  const itemRows = items.map((item, index) => {
    const baseId = item.barang?.id || item.barang_id;
    const kode = item.varian_id ? `${baseId}${item.varian_id}` : baseId;
    const namaDasar = (item.barang?.nama || '-').toUpperCase();
    const warnaHtml = item.varian_nama?.trim()
      ? `<span style="font-size:10px; color:var(--muted); font-style:italic;">(${item.varian_nama.trim().toUpperCase()})</span>`
      : '';
    const dimensiStr = parseDimensiSP(item.barang?.deskripsi);
    const dimensiHtml = dimensiStr
      ? `<p class="m-0" style="font-size:10.6px; color:var(--muted);">${dimensiStr}</p>`
      : '';

    return `
      <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-center">${kode}</td>
          <td>
              <p class="m-0" style="font-size:10.9px; font-weight:500;">
                  ${namaDasar} ${warnaHtml}
              </p>
              ${dimensiHtml}
          </td>
          <td class="text-center">${item.qty}</td>
      </tr>
    `;
  }).join('');

  const catatanHTML = sp.catatan ? `
      <p class="m-0 mt-3">
          <b style="font-weight:600;">Keterangan : </b>
          <span class="text-danger">
              ${sp.catatan.replace(/\n/g, '<br>')}
          </span>
      </p>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
    <title>Surat Pengantar - ${sp.nomor_sp} | Ilena Furniture</title>
    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
    :root {
        --ink: #0f172a;
        --muted: #4b5563;
        --line: #e5e7eb;
        --line2: #f3f4f6;
    }
    html, body {
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background: #fff;
    }
    * { font-size: 12px; line-height: 1.35; }
    h5 { font-size: 14.25px; font-weight: 600; margin: 0; letter-spacing: -.15px; }
    .subhead { font-size: 11px; color: var(--muted); font-weight: 500; margin: 0; }
    .title-doc { font-size: 13.25px; font-weight: 600; letter-spacing: .02em; }
    .divider { height: 1px; background: var(--line); margin: .4rem 0 .8rem; }
    .table { border-color: var(--line); margin-bottom: 0.5rem; }
    .table thead th {
        background: #fbfbfd !important; border-bottom: 1px solid var(--line);
        font-weight: 600; color: #0f172a; font-size: 10.25px; vertical-align: middle;
        padding: .40rem .55rem; letter-spacing: .02em; text-transform: uppercase;
    }
    .table tbody td {
        border-color: var(--line2); vertical-align: middle; font-size: 10.9px; padding: .42rem .55rem;
    }
    .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: #fcfdff; }
    .to-name { font-weight: 600; font-size: 13px; }
    body { background: #e8eaed; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
    .sig-title, .sig-name { font-weight: 600; }
    .sig-row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-top: 1rem; }
    .sig-box { min-width: 180px; text-align: center; }
    .sig-body { height: 86px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: transparent; }
    .sig-body::after {
        content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .55;
        background: radial-gradient(circle at 18% 35%, rgba(0, 0, 0, .025), transparent 58%), radial-gradient(circle at 72% 65%, rgba(0, 0, 0, .018), transparent 60%), radial-gradient(circle at 45% 82%, rgba(0, 0, 0, .012), transparent 55%);
    }
    .sig-stamp, .sig-stamp-rough {
        width: 112px; height: auto; display: block; object-fit: contain; pointer-events: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.98); background: transparent; mix-blend-mode: multiply; -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sig-stamp { z-index: 1; opacity: .62; filter: contrast(1.65) saturate(1.10) brightness(.90) blur(.06px) drop-shadow(0 .20px .25px rgba(0, 0, 0, .10)) drop-shadow(0 1.1px 1.4px rgba(0, 0, 0, .06)); }
    .sig-stamp-rough { z-index: 2; opacity: .20; transform: translate(-50%, -50%) scale(1.01); filter: blur(.34px) contrast(1.20) brightness(.92); }
    .sig-footer { height: 18px; display: flex; align-items: center; justify-content: center; font-weight: 700; line-height: 1; margin-top: 2px; }
    .sig-line { font-weight: 600; letter-spacing: .02em; margin: 0; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; min-height: 0 !important; padding: 14mm !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    ${TOOLBAR_CSS}
    </style>
</head>
<body>
    ${TOOLBAR_HTML_FULL}
    <div class="page">
        ${SIG_OVERLAY_HTML}
        <!-- Header -->
        <div class="d-flex justify-content-between my-4">
            <div style="flex:1;" class="d-flex align-items-between gap-2">
                <div class="d-flex gap-4 justify-content-start">
                    <div>
                        <img src="https://ilenafurniture.com/img/logo/logo-invoice.jpg" alt="Logo" width="70" height="40">
                    </div>
                    <div class="d-flex flex-column justify-content-center gap-1">
                        <h5>CV.CATUR BHAKTI MANDIRI</h5>
                        <p class="subhead">Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-end mb-4">
            <div style="flex:1">
                <p class="m-0 title-doc">SURAT PENGANTAR NO. ${sp.nomor_sp}</p>
                <div class="divider"></div>
            </div>

            <div style="flex:1" class="ms-5">
                <p class="m-0" style="font-weight:500;">Kepada Yth.</p>
                <p class="m-0 to-name">${penjualan.nama_penerima || '-'}</p>
                <p class="m-0 mt-1">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}</p>
            </div>
        </div>

        <!-- Tabel -->
        <div class="table-responsive mt-2">
            <table class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 40px;">NO</th>
                        <th class="text-center" style="width: 140px;">KODE BARANG</th>
                        <th class="text-center">NAMA BARANG</th>
                        <th class="text-center" style="width: 90px;">JUMLAH</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>

            ${catatanHTML}

            <p class="mt-4" style="font-weight:500;">Kendal, ${tanggalFormat}</p>

            <!-- Tanda Tangan -->
            <div class="sig-row">
                <!-- Dibuat -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibuat Oleh :</p>
                    <div class="sig-body">
                        <img src="https://ilenafurniture.com/img/logo/stampelfix.png" alt="Stempel" class="sig-stamp">
                        <img src="https://ilenafurniture.com/img/logo/stampelfix.png" alt="" class="sig-stamp-rough">
                    </div>
                    <div class="sig-footer">Admin</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>

                <!-- Dibawa -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibawa Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>

                <!-- Diterima -->
                <div class="sig-box">
                    <p class="m-0 sig-title">Diterima Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>
            </div>
        </div>
    </div>
    ${buildFullToolbarJS(`surat-pengantar-${sp.nomor_sp || 'dokumen'}.pdf`)}
</body>
</html>
  `;
};

const generateHTMLInvoice = (inv) => {
  const penjualan = inv.penjualan || {};
  const items = penjualan.items || [];
  const suratJalans = penjualan.suratJalans || [];
  
  const tanggalFormat = dayjs(inv.tanggal).format('DD MMMM YYYY');
  const jatuhTempoFormat = inv.jatuh_tempo ? dayjs(inv.jatuh_tempo).format('DD MMMM YYYY') : '-';
  
  let totalInvoice = 0;

  const parseDimensiInv = (deskripsi) => {
    try {
      const parsed = typeof deskripsi === 'string' ? JSON.parse(deskripsi) : deskripsi;
      const d = parsed?.dimensi?.asli;
      if (d && d.panjang && d.lebar && d.tinggi) return `${d.panjang} x ${d.lebar} x ${d.tinggi} cm`;
    } catch { /* ignored */ }
    return null;
  };

  const itemRows = items.map((item, index) => {
    const baseId = item.barang?.id || item.barang_id;
    const kode = item.varian_id ? `${baseId}${item.varian_id}` : baseId;
    const namaDasar = (item.barang?.nama || '-').toUpperCase();
    const warnaHtml = item.varian_nama?.trim()
      ? `<span style="font-size:10.5px; color:#6b7280; font-style:italic;">(${item.varian_nama.trim().toUpperCase()})</span>`
      : '';
    const dimensiStr = parseDimensiInv(item.barang?.deskripsi);
    const dimensiHtml = dimensiStr
      ? `<p class="m-0" style="font-size:10.5px; color:#6b7280;">${dimensiStr}</p>`
      : '';

    const subtotal = item.subtotal ? Number(item.subtotal) : (item.qty * (item.harga_satuan || 0));
    totalInvoice += subtotal;

    return `
      <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-center">${kode}</td>
          <td>
              <p class="m-0" style="font-size:11.5px;">${namaDasar} ${warnaHtml}</p>
              ${dimensiHtml}
          </td>
          <td class="text-center nowrap">${item.qty}</td>
          <td class="num nowrap">${formatRupiah(item.harga_satuan)}</td>
          <td class="num nowrap">${formatRupiah(subtotal)}</td>
      </tr>
    `;
  }).join('');

  const sjString = suratJalans.map(s => s.nomor_surat).join(', ');
  
  const bankFaktur = "BCA 8715898787 a.n. CATUR BHAKTI MANDIRI";
  const bankNonFaktur = "BCA 8715883488 a.n. EI LIE PURNAMA";
  const rekeningHtml = (penjualan.faktur === 'FAKTUR') ? bankFaktur : bankNonFaktur;

  // Lunas Watermark (If Status is COMPLETED or paid)
  // We don't have exact status here, but if needed, we can show it.
  const lunasWatermark = penjualan.status === 'COMPLETED' ? `
    <div class="print-lunas">
        <p>LUNAS</p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
    <title>Surat Invoice - ${inv.nomor_invoice} | Ilena Furniture</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
    :root {
        --merah: #b31217;
        --ink: #0f172a;
        --line: #e5e7eb;
        --line2: #f1f5f9;
        --lunas-shift-y: -12vh;
    }

    html, body {
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background: #fff;
    }

    * { font-size: 13.25px; line-height: 1.35; }
    h5, .h5 { font-size: 16px; font-weight: 600; letter-spacing: -.2px; margin: 0; }
    .tw-bold-italic { font-weight: 600; font-style: italic; }
    .nt { font-weight: 500; color: #111; font-style: italic; margin: 0; }
    .isint { font-weight: 500; font-style: italic; margin: 0; }

    .print-lunas {
        position: fixed !important; inset: 0 !important; display: grid !important; place-items: center !important; pointer-events: none !important; z-index: 2147483647 !important;
    }
    .print-lunas p {
        margin: 0; font-size: 110px; font-weight: 700; letter-spacing: .12em; color: var(--merah); opacity: .10; border: 6px solid var(--merah); padding: .12em .32em; border-radius: 12px; transform: translateY(var(--lunas-shift-y)) rotate(-15deg); user-select: none;
    }

    .table { border-color: var(--line); margin-bottom: 0.5rem; }
    .table thead th {
        background: #f8fafc !important; border-bottom: 1px solid var(--line); font-weight: 600; color: #0f172a; font-size: 11.5px; vertical-align: middle;
    }
    .table tbody td { border-color: var(--line2); vertical-align: middle; font-size: 11.5px; }
    .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: #fcfdff; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .nowrap { white-space: nowrap; }

    .kotak-pembayaran {
        border: 1px dashed #ef4444; padding: 10px 20px; align-self: center; text-align: center; font-weight: 500; font-style: italic; border-radius: 10px; background: #fff;
    }
    .title h3 { letter-spacing: -.25px; font-weight: 600; font-size: 18px; margin: 0; }

    body { background: #e8eaed; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }

    @page { size: A4 portrait; margin: 0; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; min-height: 0 !important; padding: 14mm !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img, .kotak-pembayaran { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
        .print-lunas { position: fixed !important; z-index: 2147483647 !important; }
        .kotak-pembayaran { border: 1px dashed #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${TOOLBAR_CSS}
    </style>
</head>
<body>
    ${TOOLBAR_HTML_SIMPLE}
    ${lunasWatermark}
    <div class="page">
        <!-- Header perusahaan -->
        <div class="d-flex gap-4 justify-content-start mb-4">
            <div><img src="https://ilenafurniture.com/img/logo/logo-invoice.jpg" alt="Logo" width="70" height="40"></div>
            <div class="d-flex flex-column justify-content-center gap-1">
                <h5 class="m-0">CV.CATUR BHAKTI MANDIRI</h5>
                <h6 class="m-0" style="font-size:12.5px; font-weight:500;">
                    Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang
                </h6>
            </div>
        </div>
        
        <!-- Nomor & tanggal -->
        <div class="d-flex">
            <div style="flex:1;"></div>
            <div class="d-flex gap-2 justify-content-end">
                <div class="d-flex flex-column align-items-end">
                    <p class="nt">Nomor :</p>
                    <p class="nt">Tanggal :</p>
                </div>
                <div class="d-flex flex-column align-items-start">
                    <p class="isint" style="font-weight:600;">${inv.nomor_invoice}</p>
                    <p class="isint">${tanggalFormat}</p>
                </div>
            </div>
        </div>

        <!-- Judul -->
        <div class="my-1 title">
            <h3 class="text-center">INVOICE</h3>
        </div>

        <!-- Tujuan -->
        <div class="d-flex justify-content-start mt-4 mb-4 flex-column">
            <p class="m-0 nt" style="max-width:260px; font-size:12px;">Kepada Yth.</p>
            <p class="m-0 tw-bold-italic" style="max-width:260px; font-size:12px;">${penjualan.nama_penerima || '-'}</p>
            <p class="m-0" style="max-width:260px; font-size:12px;">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}</p>
            
            ${penjualan.no_npwp ? `<p style="font-size:12px; margin-top:4px;" class="isint">NPWP/NIK : ${penjualan.no_npwp}</p>` : ''}
        </div>

        <!-- Tabel Invoice -->
        <div class="table-responsive mt-2">
            <table class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th class="text-center" style="width:10px;">NO</th>
                        <th class="text-center">KODE BARANG</th>
                        <th class="text-center">NAMA BARANG</th>
                        <th class="text-center">KUANTITAS</th>
                        <th class="text-center">HARGA SATUAN</th>
                        <th class="text-center">JUMLAH</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                    <tr>
                        <td colspan="5" class="fw-semibold">TOTAL INVOICE</td>
                        <td class="num fw-semibold">${formatRupiah(totalInvoice)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div>
            <table>
                <tbody>
                    <tr>
                        <td style="font-size:11.5px;" class="pe-3">Terbilang</td>
                        <td style="font-size:11.5px;">:
                            <i style="font-size:11.5px;">${terbilang(totalInvoice)}</i>
                        </td>
                    </tr>
                    <tr>
                        <td class="pe-3" style="white-space:nowrap; font-size:11.5px;">PO</td>
                        <td style="white-space:nowrap; font-size:11.5px;">: ${penjualan.no_po || '-'}</td>
                    </tr>
                    <tr>
                        <td class="pe-3" style="white-space:nowrap; font-size:11.5px;">Surat Jalan</td>
                        <td style="white-space:nowrap; font-size:11.5px;">:
                            <span class="text-muted">${sjString || '-'}</span>
                        </td>
                    </tr>
                    <tr>
                        <td class="pe-3" style="white-space:nowrap; font-size:11.5px;">Jatuh Tempo</td>
                        <td style="white-space:nowrap; font-size:11.5px;">: ${jatuhTempoFormat}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div class="d-flex justify-content-between mt-5 mb-3">
            <div class="d-flex flex-column kotak-pembayaran">
                <p class="m-0" style="font-size:12px;">
                    Pembayaran mohon dapat ditransfer ke rekening: <br>
                    <b style="font-size:12px; color:#ef4444;">${rekeningHtml}</b>
                </p>
            </div>
            <div class="d-flex flex-column align-items-center" style="width:200px; font-size:12px;">
                Bagian Keuangan <br><br><br><br><br>
                <p class="tw-bold-italic" style="font-size:12px;">Amaroh U'un Setiawan</p>
            </div>
        </div>
    </div>
    ${buildSimpleToolbarJS(`invoice-${inv.nomor_invoice || 'dokumen'}.pdf`)}
</body>
</html>
  `;
};

module.exports = {
  generateHTMLSuratJalan,
  generateHTMLSuratPengantar,
  generateHTMLInvoice,
};
