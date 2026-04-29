const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');
require('dayjs/locale/id');
dayjs.locale('id');

// ─── Gambar lokal → data URI (agar tidak bergantung URL eksternal) ────────────
function loadImgBase64(filename, mime) {
  try {
    const filePath = path.join(__dirname, '../../../frontend/public/img', filename);
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return ''; }
}
const LOGO_CBM   = loadImgBase64('logo-invoice.jpg', 'image/jpeg');
const LOGO_STAMP = loadImgBase64('stampelfix.png',   'image/png');

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
    @media (max-width: 600px) {
        .doc-toolbar { padding: 6px 10px; gap: 5px; }
        .tb-btn { padding: 5px 9px; font-size: 11px; }
        .tb-label-btn { padding: 5px 9px; font-size: 11px; }
        body { padding-top: 42px; }
    }
    @media print {
        .doc-toolbar { display: none !important; }
        .sig-picker-modal { display: none !important; }
        body { padding-top: 0 !important; }
        .sig-delete-btn { display: none !important; }
        .sig-resize-handle { display: none !important; }
    }
    /* Signature picker modal */
    .sig-picker-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0,0,0,0.55);
        display: none;
        align-items: center;
        justify-content: center;
    }
    .sig-picker-modal.open { display: flex; }
    .sig-picker-box {
        background: #fff;
        border-radius: 14px;
        padding: 24px;
        width: 520px;
        max-width: calc(100vw - 32px);
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        font-family: inherit;
    }
    .sig-picker-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
    }
    .sig-picker-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
    }
    .sig-picker-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 22px;
        color: #94a3b8;
        line-height: 1;
        padding: 0 4px;
        transition: color 0.15s;
    }
    .sig-picker-close:hover { color: #ef4444; }
    .sig-picker-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 18px;
        min-height: 80px;
    }
    .sig-picker-empty {
        grid-column: 1/-1;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
        padding: 24px 0;
    }
    .sig-picker-item {
        position: relative;
        border: 2px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px;
        cursor: pointer;
        background: #f8fafc;
        transition: border-color 0.15s, background 0.15s;
        aspect-ratio: 2/1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .sig-picker-item:hover { border-color: #3b82f6; background: #eff6ff; }
    .sig-picker-item.selected { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 3px rgba(37,99,235,0.18); }
    .sig-picker-item img { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
    .sig-picker-del {
        position: absolute;
        top: 4px; right: 4px;
        width: 18px; height: 18px;
        background: #ef4444;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s;
    }
    .sig-picker-item:hover .sig-picker-del { opacity: 1; }
    .sig-picker-upload {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 18px;
        background: #f1f5f9;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        transition: background 0.15s;
    }
    .sig-picker-upload:hover { background: #e2e8f0; }
    .sig-picker-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid #f1f5f9;
        padding-top: 16px;
        margin-top: 4px;
    }
    .sig-picker-confirm {
        padding: 8px 20px;
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }
    .sig-picker-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
    .sig-picker-confirm:not(:disabled):hover { background: #1d4ed8; }
`;

const TOOLBAR_HTML_FULL = `
<div class="doc-toolbar" id="docToolbar">
    <button class="tb-btn tb-btn-ghost" id="btnPickSig">&#9998; Pilih TTD</button>
    <button class="tb-btn tb-btn-ghost" id="btnAddSig" disabled>+ Tambah ke Dokumen</button>
    <span class="tb-status" id="tbStatus"></span>
    <div class="tb-sep"></div>
    <button class="tb-btn tb-btn-ghost" id="btnPrint">&#128424; Cetak</button>
    <button class="tb-btn tb-btn-primary" id="btnSavePDF">&#11015; Simpan PDF</button>
</div>

<!-- Signature picker modal -->
<div class="sig-picker-modal" id="sigPickerModal">
    <div class="sig-picker-box">
        <div class="sig-picker-header">
            <h3>&#9998; Pilih Tanda Tangan</h3>
            <button class="sig-picker-close" id="btnClosePicker">&#215;</button>
        </div>
        <div class="sig-picker-grid" id="sigPickerGrid">
            <div class="sig-picker-empty">Memuat...</div>
        </div>
        <div class="sig-picker-footer">
            <label class="sig-picker-upload">
                + Upload TTD Baru
                <input type="file" id="inputSignature" accept="image/*" style="display:none">
            </label>
            <button class="sig-picker-confirm" id="btnConfirmSig" disabled>Gunakan TTD Ini</button>
        </div>
    </div>
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
    var modal = document.getElementById('sigPickerModal');
    var grid = document.getElementById('sigPickerGrid');
    var btnConfirm = document.getElementById('btnConfirmSig');
    var selectedSigUrl = null;

    // ── Picker modal ──────────────────────────────────────────────────────────

    function loadSignatureList() {
        grid.innerHTML = '<div class="sig-picker-empty">Memuat...</div>';
        fetch(apiBase + '/api/settings/signatures', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.json(); })
        .then(function(list) {
            if (!list.length) {
                grid.innerHTML = '<div class="sig-picker-empty">Belum ada TTD tersimpan.<br>Upload TTD baru di bawah.</div>';
                return;
            }
            grid.innerHTML = '';
            list.forEach(function(sig) {
                var item = document.createElement('div');
                item.className = 'sig-picker-item';
                item.dataset.url = apiBase + sig.url + '?token=' + token + '&t=' + Date.now();
                item.dataset.id = sig.id;

                var img = document.createElement('img');
                img.src = item.dataset.url;
                img.alt = 'TTD';

                var delBtn = document.createElement('button');
                delBtn.className = 'sig-picker-del';
                delBtn.title = 'Hapus TTD ini';
                delBtn.innerHTML = '&#215;';
                delBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (!confirm('Hapus tanda tangan ini?')) return;
                    fetch(apiBase + '/api/settings/signatures/' + encodeURIComponent(sig.id), {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    })
                    .then(function() { loadSignatureList(); });
                });

                item.appendChild(img);
                item.appendChild(delBtn);
                item.addEventListener('click', function() {
                    document.querySelectorAll('.sig-picker-item').forEach(function(el) { el.classList.remove('selected'); });
                    item.classList.add('selected');
                    selectedSigUrl = item.dataset.url;
                    btnConfirm.disabled = false;
                });
                grid.appendChild(item);
            });
        })
        .catch(function() {
            grid.innerHTML = '<div class="sig-picker-empty">Gagal memuat daftar TTD.</div>';
        });
    }

    document.getElementById('btnPickSig').addEventListener('click', function() {
        selectedSigUrl = null;
        btnConfirm.disabled = true;
        modal.classList.add('open');
        loadSignatureList();
    });

    document.getElementById('btnClosePicker').addEventListener('click', function() {
        modal.classList.remove('open');
    });

    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
    });

    btnConfirm.addEventListener('click', function() {
        if (!selectedSigUrl) return;
        sigImg.src = selectedSigUrl;
        btnAddSig.disabled = false;
        tbStatus.textContent = 'TTD dipilih';
        modal.classList.remove('open');
    });

    // ── Upload TTD baru ───────────────────────────────────────────────────────

    document.getElementById('inputSignature').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        tbStatus.textContent = 'Mengupload...';
        var fd = new FormData();
        fd.append('signature', file);
        fetch(apiBase + '/api/settings/signatures', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: fd,
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            tbStatus.textContent = 'TTD berhasil diupload';
            e.target.value = '';
            loadSignatureList();
            // Auto-select the new one
            selectedSigUrl = apiBase + data.url + '?token=' + token + '&t=' + Date.now();
            sigImg.src = selectedSigUrl;
            btnAddSig.disabled = false;
            btnConfirm.disabled = false;
        })
        .catch(function() { tbStatus.textContent = 'Upload gagal'; });
    });

    // ── Tambah ke dokumen ─────────────────────────────────────────────────────

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

    // ── Drag & resize ─────────────────────────────────────────────────────────

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

    // ── Print & PDF ───────────────────────────────────────────────────────────

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

const MOBILE_SCALE_JS = `
<script>
(function() {
    function scalePage() {
        var page = document.querySelector('.page');
        if (!page) return;
        var vw = window.innerWidth;
        var pageW = 794; // A4 ~794px at 96dpi
        if (vw < pageW) {
            var scale = (vw - 8) / pageW;
            page.style.transform = 'scale(' + scale + ')';
            page.style.transformOrigin = 'top center';
            page.style.marginBottom = '-' + Math.round(pageW * (1 - scale)) + 'px';
        } else {
            page.style.transform = '';
            page.style.marginBottom = '';
        }
    }
    scalePage();
    window.addEventListener('resize', scalePage);
})();
</script>
`;

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
        return `${d.panjang} x ${d.lebar} x ${d.tinggi} mm`;
      }
    } catch { /* ignored */ }
    return null;
  };

  // Rows for items
  const itemRows = items.map((item, index) => {
    const baseId = item.barang?.id || item.barang_id;
    const kode = item.varian_id ? `${baseId}${item.varian_id}` : baseId;
    const namaDasar = (item.barang?.nama || '-').toUpperCase();
    const diskon = item.diskon || 0;
    const warnaHtml = item.varian_nama?.trim()
      ? `<span style="font-size:10px; color:var(--muted); font-style:italic;">(${item.varian_nama.trim().toUpperCase()})</span>`
      : '';
    const isSpesial = diskon !== 0;
    const spesialHtml = isSpesial
      ? `<span style="font-size:9px; color:#b45309; font-weight:700; background:#fef3c7; border-radius:3px; padding:1px 4px; white-space:nowrap;">[SPESIAL PRICE]</span>`
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
                  ${namaDasar} ${warnaHtml} ${spesialHtml}
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
    <meta content="width=device-width, initial-scale=1" name="viewport">
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
                        <img src="${LOGO_CBM}" alt="Logo" width="70" height="40">
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
                <p class="m-0 mt-1">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}${penjualan.pengirim_kode_pos ? ` ${penjualan.pengirim_kode_pos}` : ''}</p>
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
                        <img src="${LOGO_STAMP}" alt="Stempel" class="sig-stamp">
                        <img src="${LOGO_STAMP}" alt="" class="sig-stamp-rough">
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
    ${MOBILE_SCALE_JS}
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
      if (d && d.panjang && d.lebar && d.tinggi) return `${d.panjang} x ${d.lebar} x ${d.tinggi} mm`;
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
    <meta content="width=device-width, initial-scale=1" name="viewport">
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
                        <img src="${LOGO_CBM}" alt="Logo" width="70" height="40">
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
                <p class="m-0 mt-1">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}${penjualan.pengirim_kode_pos ? ` ${penjualan.pengirim_kode_pos}` : ''}</p>
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
                        <img src="${LOGO_STAMP}" alt="Stempel" class="sig-stamp">
                        <img src="${LOGO_STAMP}" alt="" class="sig-stamp-rough">
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
    ${MOBILE_SCALE_JS}
</body>
</html>
  `;
};

const generateHTMLSuratPengantarInterior = (sp) => {
  const penjualan = sp.penjualan || {};
  const items = sp.items || [];
  const tanggalFormat = dayjs(sp.tanggal).format('DD MMMM YYYY');

  const itemRows = items.map((item, index) => `
    <tr>
        <td class="text-center">${index + 1}</td>
        <td class="text-center">${item.kode_barang || '-'}</td>
        <td>${(item.nama_barang || '-').toUpperCase()}</td>
        <td class="text-center">${item.qty}</td>
    </tr>
  `).join('');

  const catatanHTML = sp.catatan ? `
    <p class="m-0 mt-3">
        <b style="font-weight:600;">Keterangan : </b>
        <span class="text-danger">${sp.catatan.replace(/\n/g, '<br>')}</span>
    </p>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>Surat Pengantar Interior - ${sp.nomor_surat} | Ilena Furniture</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
    :root { --ink: #0f172a; --muted: #4b5563; --line: #e5e7eb; --line2: #f3f4f6; }
    html, body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; background: #fff; }
    * { font-size: 12px; line-height: 1.35; }
    h5 { font-size: 14.25px; font-weight: 600; margin: 0; letter-spacing: -.15px; }
    .subhead { font-size: 11px; color: var(--muted); font-weight: 500; margin: 0; }
    .title-doc { font-size: 13.25px; font-weight: 600; letter-spacing: .02em; }
    .divider { height: 1px; background: var(--line); margin: .4rem 0 .8rem; }
    .table { border-color: var(--line); margin-bottom: 0.5rem; }
    .table thead th { background: #fbfbfd !important; border-bottom: 1px solid var(--line); font-weight: 600; color: #0f172a; font-size: 10.25px; vertical-align: middle; padding: .40rem .55rem; letter-spacing: .02em; text-transform: uppercase; }
    .table tbody td { border-color: var(--line2); vertical-align: middle; font-size: 10.9px; padding: .42rem .55rem; }
    .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: #fcfdff; }
    .to-name { font-weight: 600; font-size: 13px; }
    body { background: #e8eaed; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
    .sig-title, .sig-name { font-weight: 600; }
    .sig-row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-top: 1rem; }
    .sig-box { min-width: 180px; text-align: center; }
    .sig-body { height: 86px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .sig-stamp, .sig-stamp-rough { width: 112px; height: auto; display: block; object-fit: contain; pointer-events: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.98); mix-blend-mode: multiply; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sig-stamp { z-index: 1; opacity: .62; filter: contrast(1.65) saturate(1.10) brightness(.90) blur(.06px); }
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
                    <div><img src="${LOGO_CBM}" alt="Logo" width="70" height="40"></div>
                    <div class="d-flex flex-column justify-content-center gap-1">
                        <h5>CV.CATUR BHAKTI MANDIRI</h5>
                        <p class="subhead">Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-end mb-4">
            <div style="flex:1">
                <p class="m-0 title-doc">SURAT PENGANTAR NO. ${sp.nomor_surat}</p>
                <div class="divider"></div>
            </div>
            <div style="flex:1" class="ms-5">
                <p class="m-0" style="font-weight:500;">Kepada Yth.</p>
                <p class="m-0 to-name">${penjualan.nama_customer || '-'}</p>
                ${penjualan.nama_pt_npwp ? `<p class="m-0 mt-1" style="font-size:11px;color:var(--muted);">${penjualan.nama_pt_npwp}</p>` : ''}
                ${(() => {
                  const parts = [penjualan.alamat_detail, penjualan.alamatKelurahan?.label, penjualan.alamatKecamatan?.label, penjualan.alamatKabupaten?.label, penjualan.alamatProvinsi?.label].filter(Boolean);
                  const kodePos = penjualan.alamat_kode_pos ? ` ${penjualan.alamat_kode_pos}` : '';
                  return parts.length ? `<p class="m-0 mt-1" style="font-size:11px;color:var(--muted);">${parts.join(', ')}${kodePos}</p>` : '';
                })()}
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

            <div class="sig-row">
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibuat Oleh :</p>
                    <div class="sig-body">
                        <img src="${LOGO_STAMP}" alt="Stempel" class="sig-stamp">
                        <img src="${LOGO_STAMP}" alt="" class="sig-stamp-rough">
                    </div>
                    <div class="sig-footer">Admin</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>
                <div class="sig-box">
                    <p class="m-0 sig-title">Dibawa Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>
                <div class="sig-box">
                    <p class="m-0 sig-title">Diterima Oleh :</p>
                    <div class="sig-body"></div>
                    <div class="sig-footer">&nbsp;</div>
                    <p class="m-0 sig-name sig-line">____________________</p>
                </div>
            </div>
        </div>
    </div>
    ${buildFullToolbarJS(`sp-interior-${sp.nomor_surat ? sp.nomor_surat.replace(/\//g, '-') : 'dokumen'}.pdf`)}
    ${MOBILE_SCALE_JS}
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
      if (d && d.panjang && d.lebar && d.tinggi) return `${d.panjang} x ${d.lebar} x ${d.tinggi} mm`;
    } catch { /* ignored */ }
    return null;
  };

  const itemRows = items.map((item, index) => {
    const baseId = item.barang?.id || item.barang_id;
    const kode = item.varian_id ? `${baseId}${item.varian_id}` : baseId;
    const namaDasar = (item.barang?.nama || '-').toUpperCase();
    const diskon = item.diskon || 0;
    const warnaHtml = item.varian_nama?.trim()
      ? `<span style="font-size:10.5px; color:#6b7280; font-style:italic;">(${item.varian_nama.trim().toUpperCase()})</span>`
      : '';
    const isSpesial = diskon !== 0;
    const spesialHtml = isSpesial
      ? `<br><span style="font-size:9px; color:#b45309; font-weight:700; background:#fef3c7; border-radius:3px; padding:1px 5px; white-space:nowrap;">[SPESIAL PRICE]</span>`
      : '';
    const dimensiStr = parseDimensiInv(item.barang?.deskripsi);
    const dimensiHtml = dimensiStr
      ? `<p class="m-0" style="font-size:10.5px; color:#6b7280;">${dimensiStr}</p>`
      : '';

    const subtotal = item.subtotal ? Number(item.subtotal) : (item.qty * (item.harga_satuan || 0) * (1 - Math.max(0, diskon) / 100));
    const hargaEfektif = diskon > 0
      ? Math.round((item.harga_satuan || 0) * (1 - diskon / 100))
      : (item.harga_satuan || 0);
    totalInvoice += subtotal;

    return `
      <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-center">${kode}</td>
          <td>
              <p class="m-0" style="font-size:11px;">${namaDasar} ${warnaHtml}${spesialHtml}</p>
              ${dimensiHtml}
          </td>
          <td class="text-center nowrap">${item.qty}</td>
          <td class="num nowrap">${formatRupiah(hargaEfektif)}</td>
          <td class="num nowrap">${formatRupiah(subtotal)}</td>
      </tr>
    `;
  }).join('');

  const sjString = suratJalans.map(s => (s.nomor_surat || '').split('/')[0]).join(', ');

  // PPN calculation
  const ppnPersen = Number(inv.ppn_persen) || 0;
  const ppnAmount = Math.round(totalInvoice * ppnPersen / 100);
  const grandTotal = totalInvoice + ppnAmount;

  const bankFaktur = "BCA 8715898787 a.n. CATUR BHAKTI MANDIRI";
  const bankNonFaktur = "BCA 8715883488 a.n. EL LIE PURNAMA";
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
    <meta content="width=device-width, initial-scale=1" name="viewport">
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
            <div><img src="${LOGO_CBM}" alt="Logo" width="70" height="40"></div>
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
            <p class="m-0 tw-bold-italic" style="max-width:260px; font-size:12px;">${penjualan.nama_npwp || penjualan.nama_penerima || '-'}</p>
            <p class="m-0" style="max-width:260px; font-size:12px;">${toTitleCase([penjualan.pengirim_detail, penjualan.pengirimKelurahan?.label, penjualan.pengirimKecamatan?.label, penjualan.pengirimKabupaten?.label, penjualan.pengirimProvinsi?.label].filter(Boolean).join(', '))}${penjualan.pengirim_kode_pos ? ` ${penjualan.pengirim_kode_pos}` : ''}</p>

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
                        <td colspan="5" class="fw-semibold">SUBTOTAL</td>
                        <td class="num fw-semibold">${formatRupiah(totalInvoice)}</td>
                    </tr>
                    ${ppnPersen > 0 ? `
                    <tr>
                        <td colspan="5" class="fw-semibold">PPN ${ppnPersen}%</td>
                        <td class="num fw-semibold">${formatRupiah(ppnAmount)}</td>
                    </tr>
                    <tr style="background:#fff8f8;">
                        <td colspan="5" class="fw-semibold" style="color:#ef4444;">TOTAL INVOICE</td>
                        <td class="num fw-semibold" style="color:#ef4444;">${formatRupiah(grandTotal)}</td>
                    </tr>` : `
                    <tr>
                        <td colspan="5" class="fw-semibold">TOTAL INVOICE</td>
                        <td class="num fw-semibold">${formatRupiah(totalInvoice)}</td>
                    </tr>`}
                </tbody>
            </table>
        </div>
        
        <div>
            <table>
                <tbody>
                    <tr>
                        <td style="font-size:11.5px;" class="pe-3">Terbilang</td>
                        <td style="font-size:11.5px;">:
                            <i style="font-size:11.5px;">${terbilang(grandTotal)}</i>
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
    ${MOBILE_SCALE_JS}
</body>
</html>
  `;
};

const generateHTMLProforma = (inv) => {
  const penjualan = inv.penjualan || {};
  const items = penjualan.items || [];
  const pembayarans = penjualan.pembayarans || [];

  // Parse stored terms (payment plan)
  let terms = [];
  try { terms = inv.terms ? JSON.parse(inv.terms) : []; } catch { terms = []; }

  const tanggalFormat = dayjs(inv.tanggal).format('DD MMMM YYYY');
  const isFaktur = penjualan.faktur === 'FAKTUR';
  const bankInfo = isFaktur
    ? 'BCA 8715898787 a.n. CATUR BHAKTI MANDIRI'
    : 'BCA 8715883488 a.n. EL LIE PURNAMA';

  let subtotalTotal = 0;
  const itemRows = items.map((item, index) => {
    const subtotal = Number(item.subtotal || 0) || (item.qty * (item.harga_satuan || 0));
    subtotalTotal += subtotal;
    return `
      <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-center" style="font-size:11px;">${item.kode_barang || '-'}</td>
          <td style="font-size:11px;">${(item.nama_barang || '-').toUpperCase()}</td>
          <td class="text-center">${item.qty}</td>
          <td class="num">${formatRupiah(item.harga_satuan)}</td>
          <td class="num">${formatRupiah(subtotal)}</td>
      </tr>`;
  }).join('');

  const ppnPersen = penjualan.pakai_ppn && penjualan.ppn_persen ? parseInt(penjualan.ppn_persen) : 0;
  const ppnAmount = Math.round(subtotalTotal * ppnPersen / 100);
  const grandTotal = subtotalTotal + ppnAmount;

  // Summary rows
  const summaryRows = isFaktur ? `
    <tr><td colspan="5" class="fw-semibold" style="font-size:11.5px;">DASAR PENGENAAN PAJAK</td>
        <td class="num fw-semibold" style="font-size:11.5px;">${formatRupiah(subtotalTotal)}</td></tr>
    ${ppnPersen > 0 ? `<tr><td colspan="5" style="font-size:11.5px;">PPN ${ppnPersen}%</td>
        <td class="num" style="font-size:11.5px;">${formatRupiah(ppnAmount)}</td></tr>` : ''}
    <tr style="background:#fff8f8;">
        <td colspan="5" class="fw-bold" style="color:#dc2626;font-size:11.5px;">JUMLAH</td>
        <td class="num fw-bold" style="color:#dc2626;font-size:11.5px;">${formatRupiah(grandTotal)}</td>
    </tr>
  ` : `
    <tr><td colspan="5" class="fw-semibold" style="font-size:11.5px;">SUBTOTAL</td>
        <td class="num fw-semibold" style="font-size:11.5px;">${formatRupiah(subtotalTotal)}</td></tr>
    <tr style="background:#fff8f8;">
        <td colspan="5" class="fw-bold" style="color:#dc2626;font-size:11.5px;">JUMLAH</td>
        <td class="num fw-bold" style="color:#dc2626;font-size:11.5px;">${formatRupiah(grandTotal)}</td>
    </tr>
  `;

  // Payment terms rows
  const TIPE_LABEL = {
    TERMIN_1: 'TERMIN 1',
    TERMIN_2: 'TERMIN 2',
    TERMIN_3: 'TERMIN 3',
    PELUNASAN_AKHIR: 'PELUNASAN AKHIR',
  };
  let termRows = '';
  const totalPaid = pembayarans.reduce((s, p) => s + Number(p.jumlah || 0), 0);
  const priorTermsByTipe = inv.priorTermsByTipe || {};

  if (terms.length > 0 || pembayarans.length > 0) {
    // Group payments by tipe in order
    const paymentsByTipe = {};
    pembayarans.forEach(p => {
      const tipe = p.tipe || 'DP';
      if (!paymentsByTipe[tipe]) paymentsByTipe[tipe] = [];
      paymentsByTipe[tipe].push(p);
    });

    // Total DP terms across ALL proformas for numbering decision
    const totalDPTerms = (priorTermsByTipe['DP'] || 0) + terms.filter(t => (t.tipe || 'DP') === 'DP').length;

    // 1. Show ALL actual payments (includes payments from prior proformas)
    const tipePayCounter = {};
    pembayarans.forEach(p => {
      const tipe = p.tipe || 'DP';
      if (!tipePayCounter[tipe]) tipePayCounter[tipe] = 0;
      tipePayCounter[tipe]++;

      let label;
      if (tipe === 'DP') {
        label = totalDPTerms > 1 ? `UANG MUKA KE-${tipePayCounter[tipe]}` : 'UANG MUKA';
      } else {
        label = TIPE_LABEL[tipe] || tipe;
      }

      termRows += `
        <tr style="background:#f0fdf4;">
            <td colspan="4" style="font-size:11.5px;font-weight:600;">${label} <span style="font-size:10px;color:#16a34a;font-style:italic;">terbayar tanggal ${dayjs(p.tanggal).format('DD/MM/YYYY')}</span></td>
            <td class="num" style="font-size:11.5px;">${formatRupiah(Number(p.jumlah || 0))}</td>
            <td></td>
        </tr>`;
    });

    // 2. Show unpaid terms from this proforma (sequential match using priorTermsByTipe offset)
    const tipeMatchCount = { ...priorTermsByTipe };
    const dpPaidCount = (paymentsByTipe['DP'] || []).length;
    let dpUnpaidCounter = dpPaidCount;

    terms.forEach(term => {
      const tipe = term.tipe || 'DP';
      if (!tipeMatchCount[tipe]) tipeMatchCount[tipe] = 0;
      const matchedPayment = (paymentsByTipe[tipe] || [])[tipeMatchCount[tipe]] || null;
      tipeMatchCount[tipe]++;

      if (!matchedPayment) {
        const jumlah = Number(term.jumlah) || 0;
        const persen = term.persen ? parseFloat(term.persen) : null;
        let label;
        if (tipe === 'DP') {
          dpUnpaidCounter++;
          label = totalDPTerms > 1 ? `UANG MUKA KE-${dpUnpaidCounter}` : 'UANG MUKA';
        } else {
          label = TIPE_LABEL[tipe] || tipe;
        }
        const persenLabel = persen ? ` <span style="font-size:10px;color:#2563eb;font-weight:600;">(${persen}%)</span>` : '';

        termRows += `
          <tr style="background:#fafafa;">
              <td colspan="4" style="font-size:11.5px;font-weight:600;">${label}${persenLabel} <span style="font-size:10px;color:#94a3b8;font-style:italic;">belum terbayar</span></td>
              <td class="num" style="font-size:11.5px;">${jumlah > 0 ? formatRupiah(jumlah) : ''}</td>
              <td></td>
          </tr>`;

        // Per-product breakdown jika ada persen
        if (persen && items.length > 0) {
          items.forEach(item => {
            const itemSubtotal = Number(item.subtotal) || (item.qty * (item.harga_satuan || 0));
            const itemAmount = Math.round(itemSubtotal * persen / 100);
            termRows += `
              <tr style="background:#eff6ff;">
                  <td style="font-size:10px;padding-left:24px;color:#475569;">↳ ${(item.nama_barang || '-').toUpperCase()} (${item.qty} unit)</td>
                  <td colspan="3" style="font-size:10px;color:#475569;"></td>
                  <td class="num" style="font-size:10px;color:#1d4ed8;font-weight:600;">${formatRupiah(itemAmount)}</td>
                  <td></td>
              </tr>`;
          });
        }
      }
    });

    const sisa = grandTotal - totalPaid;
    termRows += `
      <tr style="background:#fef2f2;">
          <td colspan="4" style="font-size:11.5px;font-weight:700;color:#dc2626;">SISA</td>
          <td class="num fw-bold" style="font-size:11.5px;color:#dc2626;">${formatRupiah(Math.max(0, sisa))}</td>
          <td></td>
      </tr>`;
  }

  const npwpRow = penjualan.no_npwp
    ? `<p style="font-size:12px;margin-top:4px;" class="isint">NPWP/NIK : ${penjualan.no_npwp}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>Proforma Invoice - ${inv.nomor_proforma} | Ilena Furniture</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
    :root { --merah: #b31217; --ink: #0f172a; --line: #e5e7eb; --line2: #f1f5f9; }
    html, body { font-family: Inter, system-ui, sans-serif; color: var(--ink); background: #fff; -webkit-font-smoothing: antialiased; }
    * { font-size: 13px; line-height: 1.35; }
    h5 { font-size: 16px; font-weight: 600; letter-spacing: -.2px; margin: 0; }
    .nt { font-weight: 500; color: #111; font-style: italic; margin: 0; }
    .isint { font-weight: 500; font-style: italic; margin: 0; }
    .tw-bold-italic { font-weight: 600; font-style: italic; }
    .table { border-color: var(--line); margin-bottom: 0.5rem; }
    .table thead th { background: #f8fafc !important; border-bottom: 1px solid var(--line); font-weight: 600; color: #0f172a; font-size: 11px; vertical-align: middle; }
    .table tbody td { border-color: var(--line2); vertical-align: middle; }
    .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: #fcfdff; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .kotak-pembayaran { border: 1px dashed #ef4444; padding: 10px 20px; text-align: center; font-weight: 500; font-style: italic; border-radius: 10px; background: #fff; }
    .title h3 { letter-spacing: -.25px; font-weight: 600; font-size: 18px; margin: 0; }
    body { background: #e8eaed; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; min-height: 0 !important; padding: 14mm !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, .kotak-pembayaran { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
        .kotak-pembayaran { border: 1px dashed #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${TOOLBAR_CSS}
    </style>
</head>
<body>
    ${TOOLBAR_HTML_FULL}
    <div class="page">
        ${SIG_OVERLAY_HTML}

        <!-- Header perusahaan -->
        <div class="d-flex gap-4 justify-content-start mb-4">
            <div><img src="${LOGO_CBM}" alt="Logo" width="70" height="40"></div>
            <div class="d-flex flex-column justify-content-center gap-1">
                <h5>CV.CATUR BHAKTI MANDIRI</h5>
                <h6 class="m-0" style="font-size:12px;font-weight:500;">Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang</h6>
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
                    <p class="isint" style="font-weight:600;">${inv.nomor_proforma}</p>
                    <p class="isint">${tanggalFormat}</p>
                </div>
            </div>
        </div>

        <!-- Judul -->
        <div class="my-2 title">
            <h3 class="text-center">PROFORMA INVOICE</h3>
        </div>

        <!-- Tujuan -->
        <div class="d-flex justify-content-start mt-3 mb-4 flex-column">
            <p class="m-0 nt" style="font-size:12px;">Kepada Yth.</p>
            <p class="m-0 tw-bold-italic" style="font-size:12px;">${penjualan.nama_customer || '-'}</p>
            ${penjualan.nama_pt_npwp ? `<p class="m-0" style="font-size:12px;color:#475569;">${penjualan.nama_pt_npwp}</p>` : ''}
            ${(() => {
              const parts = [penjualan.alamat_detail, penjualan.alamatKelurahan?.label, penjualan.alamatKecamatan?.label, penjualan.alamatKabupaten?.label, penjualan.alamatProvinsi?.label].filter(Boolean);
              const kodePos = penjualan.alamat_kode_pos ? ` ${penjualan.alamat_kode_pos}` : '';
              return parts.length ? `<p class="m-0" style="font-size:11px;color:#64748b;">${parts.join(', ')}${kodePos}</p>` : '';
            })()}
            ${npwpRow}
        </div>

        <!-- Tabel items -->
        <div class="table-responsive">
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
                    ${summaryRows}
                    ${termRows}
                </tbody>
            </table>
        </div>

        <!-- Terbilang -->
        <div class="mt-1 mb-3">
            <table>
                <tbody>
                    <tr>
                        <td style="font-size:11.5px;" class="pe-3">Terbilang</td>
                        <td style="font-size:11.5px;">: <i>${terbilang(grandTotal)}</i></td>
                    </tr>
                    ${penjualan.no_po ? `<tr><td class="pe-3" style="font-size:11.5px;">No. PO</td>
                        <td style="font-size:11.5px;">: <b>${penjualan.no_po}</b></td></tr>` : ''}
                    ${inv.catatan ? `<tr><td class="pe-3" style="font-size:11.5px;">Catatan</td>
                        <td style="font-size:11.5px;">: ${inv.catatan}</td></tr>` : ''}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div class="d-flex justify-content-between align-items-start mt-4 mb-3 gap-4">
            <div class="kotak-pembayaran" style="flex:1;max-width:340px;">
                <p class="m-0" style="font-size:12px;">
                    Pembayaran mohon dapat ditransfer ke rekening:
                </p>
                <p class="m-0 mt-1" style="font-size:12px;font-weight:700;color:#ef4444;">${bankInfo}</p>
            </div>
            <div class="d-flex flex-column align-items-center" style="width:180px;font-size:12px;flex-shrink:0;">
                Bagian Keuangan <br><br><br><br><br>
                <p class="tw-bold-italic" style="font-size:12px;">Amaroh U'un Setiawan</p>
            </div>
        </div>
    </div>
    ${buildFullToolbarJS(`proforma-${inv.nomor_proforma ? inv.nomor_proforma.replace(/\//g, '-') : 'dokumen'}.pdf`)}
    ${MOBILE_SCALE_JS}
</body>
</html>
  `;
};

const generateHTMLSubInvoice = (inv) => {
  const penjualan = inv.penjualan || {};
  const items = penjualan.items || [];

  let terms = [];
  try { terms = inv.terms ? JSON.parse(inv.terms) : []; } catch { terms = []; }

  const tanggalFormat = dayjs(inv.tanggal).format('DD MMMM YYYY');
  const isFaktur = penjualan.faktur === 'FAKTUR';
  const bankInfo = isFaktur
    ? 'BCA 8715898787 a.n. CATUR BHAKTI MANDIRI'
    : 'BCA 8715883488 a.n. EL LIE PURNAMA';

  const TIPE_LABEL = {
    DP: 'DP', TERMIN_1: 'Termin 1', TERMIN_2: 'Termin 2',
    TERMIN_3: 'Termin 3', PELUNASAN_AKHIR: 'Pelunasan Akhir',
  };

  let rowNo = 0;
  let grandTotalSub = 0;
  let itemRows = '';

  terms.forEach(term => {
    const persen = term.persen ? parseFloat(term.persen) : null;
    if (!persen || persen <= 0) return;
    const tipeLabel = TIPE_LABEL[term.tipe || 'DP'] || (term.tipe || 'DP');
    const persenLabel = `${tipeLabel} ${persen}%`;

    items.forEach(item => {
      const itemSubtotal = Number(item.subtotal) || (item.qty * (item.harga_satuan || 0));
      const amount = Math.round(itemSubtotal * persen / 100);
      grandTotalSub += amount;
      rowNo++;
      itemRows += `
        <tr>
            <td class="text-center">${rowNo}</td>
            <td class="text-center" style="font-size:11px;">${item.kode_barang || '-'}</td>
            <td style="font-size:11px;">${(item.nama_barang || '-').toUpperCase()} <span style="font-size:10px;color:#2563eb;font-style:italic;">(${persenLabel})</span></td>
            <td class="text-center">1</td>
            <td class="num" style="color:#94a3b8;">-</td>
            <td class="num">${formatRupiah(amount)}</td>
        </tr>`;
    });
  });

  const summaryRow = `
    <tr style="background:#fff8f8;">
        <td colspan="5" class="fw-bold" style="color:#dc2626;font-size:11.5px;">JUMLAH</td>
        <td class="num fw-bold" style="color:#dc2626;font-size:11.5px;">${formatRupiah(grandTotalSub)}</td>
    </tr>`;

  const npwpRow = penjualan.no_npwp
    ? `<p style="font-size:12px;margin-top:4px;" class="isint">NPWP/NIK : ${penjualan.no_npwp}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>Sub Invoice - ${inv.nomor_proforma} | Ilena Furniture</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
    :root { --merah: #b31217; --ink: #0f172a; --line: #e5e7eb; --line2: #f1f5f9; }
    html, body { font-family: Inter, system-ui, sans-serif; color: var(--ink); background: #fff; -webkit-font-smoothing: antialiased; }
    * { font-size: 13px; line-height: 1.35; }
    h5 { font-size: 16px; font-weight: 600; letter-spacing: -.2px; margin: 0; }
    .nt { font-weight: 500; color: #111; font-style: italic; margin: 0; }
    .isint { font-weight: 500; font-style: italic; margin: 0; }
    .tw-bold-italic { font-weight: 600; font-style: italic; }
    .table { border-color: var(--line); margin-bottom: 0.5rem; }
    .table thead th { background: #f8fafc !important; border-bottom: 1px solid var(--line); font-weight: 600; color: #0f172a; font-size: 11px; vertical-align: middle; }
    .table tbody td { border-color: var(--line2); vertical-align: middle; }
    .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: #fcfdff; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .kotak-pembayaran { border: 1px dashed #ef4444; padding: 10px 20px; text-align: center; font-weight: 500; font-style: italic; border-radius: 10px; background: #fff; }
    .title h3 { letter-spacing: -.25px; font-weight: 600; font-size: 18px; margin: 0; }
    body { background: #e8eaed; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; min-height: 0 !important; padding: 14mm !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, .kotak-pembayaran { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
        .kotak-pembayaran { border: 1px dashed #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${TOOLBAR_CSS}
    </style>
</head>
<body>
    ${TOOLBAR_HTML_FULL}
    <div class="page">
        ${SIG_OVERLAY_HTML}

        <!-- Header perusahaan -->
        <div class="d-flex gap-4 justify-content-start mb-4">
            <div><img src="${LOGO_CBM}" alt="Logo" width="70" height="40"></div>
            <div class="d-flex flex-column justify-content-center gap-1">
                <h5>CV.CATUR BHAKTI MANDIRI</h5>
                <h6 class="m-0" style="font-size:12px;font-weight:500;">Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang</h6>
            </div>
        </div>

        <!-- Nomor & tanggal -->
        <div class="d-flex">
            <div style="flex:1;"></div>
            <div class="d-flex gap-2 justify-content-end">
                <div class="d-flex flex-column align-items-end">
                    <p class="nt">Nomor :</p>
                    <p class="nt">Tanggal :</p>
                    <p class="nt">Surat Jalan :</p>
                </div>
                <div class="d-flex flex-column align-items-start">
                    <p class="isint" style="font-weight:600;">${inv.nomor_proforma}</p>
                    <p class="isint">${tanggalFormat}</p>
                    <p class="isint">-</p>
                </div>
            </div>
        </div>

        <!-- Judul -->
        <div class="my-2 title">
            <h3 class="text-center">SUB INVOICE</h3>
        </div>

        <!-- Tujuan -->
        <div class="d-flex justify-content-start mt-3 mb-4 flex-column">
            <p class="m-0 nt" style="font-size:12px;">Kepada Yth.</p>
            <p class="m-0 tw-bold-italic" style="font-size:12px;">${penjualan.nama_customer || '-'}</p>
            ${penjualan.nama_pt_npwp ? `<p class="m-0" style="font-size:12px;color:#475569;">${penjualan.nama_pt_npwp}</p>` : ''}
            ${(() => {
              const parts = [penjualan.alamat_detail, penjualan.alamatKelurahan?.label, penjualan.alamatKecamatan?.label, penjualan.alamatKabupaten?.label, penjualan.alamatProvinsi?.label].filter(Boolean);
              const kodePos = penjualan.alamat_kode_pos ? ` ${penjualan.alamat_kode_pos}` : '';
              return parts.length ? `<p class="m-0" style="font-size:11px;color:#64748b;">${parts.join(', ')}${kodePos}</p>` : '';
            })()}
            ${npwpRow}
        </div>

        <!-- Tabel items -->
        <div class="table-responsive">
            <table class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th class="text-center" style="width:10px;">NO</th>
                        <th class="text-center">KODE BARANG</th>
                        <th class="text-center">KETERANGAN</th>
                        <th class="text-center">KUANTITAS</th>
                        <th class="text-center">HARGA</th>
                        <th class="text-center">JUMLAH</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows || '<tr><td colspan="6" class="text-center" style="color:#94a3b8;padding:16px;">Tidak ada rincian per produk (persen tidak diisi)</td></tr>'}
                    ${summaryRow}
                </tbody>
            </table>
        </div>

        <!-- Terbilang -->
        <div class="mt-1 mb-3">
            <table>
                <tbody>
                    <tr>
                        <td style="font-size:11.5px;" class="pe-3">Terbilang</td>
                        <td style="font-size:11.5px;">: <i>${terbilang(grandTotalSub)}</i></td>
                    </tr>
                    ${penjualan.no_po ? `<tr><td class="pe-3" style="font-size:11.5px;">No. PO</td>
                        <td style="font-size:11.5px;">: <b>${penjualan.no_po}</b></td></tr>` : ''}
                    ${inv.catatan ? `<tr><td class="pe-3" style="font-size:11.5px;">Catatan</td>
                        <td style="font-size:11.5px;">: ${inv.catatan}</td></tr>` : ''}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div class="d-flex justify-content-between align-items-start mt-4 mb-3 gap-4">
            <div class="kotak-pembayaran" style="flex:1;max-width:340px;">
                <p class="m-0" style="font-size:12px;">Pembayaran mohon dapat ditransfer ke rekening:</p>
                <p class="m-0 mt-1" style="font-size:12px;font-weight:700;color:#ef4444;">${bankInfo}</p>
            </div>
            <div class="d-flex flex-column align-items-center" style="width:180px;font-size:12px;flex-shrink:0;">
                Bagian Keuangan <br><br><br><br><br>
                <p class="tw-bold-italic" style="font-size:12px;">Amaroh U'un Setiawan</p>
            </div>
        </div>
    </div>
    ${buildFullToolbarJS(`sub-invoice-${inv.nomor_proforma ? inv.nomor_proforma.replace(/\//g, '-') : 'dokumen'}.pdf`)}
    ${MOBILE_SCALE_JS}
</body>
</html>
  `;
};

module.exports = {
  generateHTMLSuratJalan,
  generateHTMLSuratPengantar,
  generateHTMLSuratPengantarInterior,
  generateHTMLInvoice,
  generateHTMLProforma,
  generateHTMLSubInvoice,
};
