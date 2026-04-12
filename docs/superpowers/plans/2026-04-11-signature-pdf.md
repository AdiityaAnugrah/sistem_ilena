# Signature & Save as PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah toolbar di dokumen print (Surat Jalan, Surat Pengantar, Invoice) dengan fitur: upload + drag tanda tangan (SJ/SP only), tombol Cetak, tombol Simpan PDF.

**Architecture:** Backend menyimpan satu file gambar tanda tangan di `backend/uploads/signature.png` via endpoint `/api/settings/signature`. Frontend (inline di HTML template) menampilkan toolbar dan signature overlay yang draggable+resizable di dalam `.page`. html2pdf.js (CDN) digunakan untuk export PDF langsung tanpa dialog.

**Tech Stack:** Node.js + Express + multer (sudah terinstall v2.1.1), html2pdf.js CDN, vanilla JS inline di htmlGenerator.js.

---

## File Structure

- Create: `backend/uploads/` — direktori penyimpanan signature
- Create: `backend/src/routes/settings.js` — endpoint upload & serve signature
- Modify: `backend/src/app.js` — daftarkan route settings
- Modify: `backend/src/utils/htmlGenerator.js` — toolbar + signature + PDF di semua 3 generator

---

### Task 1: Backend Signature Endpoint

**Files:**
- Create: `backend/uploads/.gitkeep` (pastikan folder ada)
- Create: `backend/src/routes/settings.js`
- Modify: `backend/src/app.js`

**Konteks:**
- multer v2.1.1 sudah terinstall
- `authenticate` dari `../middleware/auth`
- File disimpan ke `backend/uploads/signature.png` (selalu overwrite nama yang sama)
- `path` dan `fs` dari Node.js built-in
- `__dirname` dalam `routes/settings.js` mengarah ke `backend/src/routes/`

- [ ] **Step 1: Buat direktori uploads**

```bash
mkdir -p c:/xampp/htdocs/sistem_ilena/backend/uploads
```

- [ ] **Step 2: Buat `backend/src/routes/settings.js`**

```js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SIGNATURE_PATH = path.join(UPLOADS_DIR, 'signature.png');

// Pastikan folder uploads ada
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, 'signature.png'),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diizinkan'));
    }
    cb(null, true);
  },
});

// POST /api/settings/signature — upload tanda tangan
router.post('/signature', authenticate, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File tanda tangan wajib diupload' });
    }
    await logAction(req.user.id, 'UPLOAD_SIGNATURE', 'Upload tanda tangan sistem', req.ip);
    return res.json({ message: 'Tanda tangan berhasil disimpan' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/settings/signature — ambil tanda tangan
router.get('/signature', authenticate, (req, res) => {
  if (!fs.existsSync(SIGNATURE_PATH)) {
    return res.status(404).json({ message: 'Tanda tangan belum diupload' });
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SIGNATURE_PATH);
});

module.exports = router;
```

- [ ] **Step 3: Daftarkan route di `backend/src/app.js`**

Tambahkan setelah baris `app.use('/api/users', require('./routes/users'));`:

```js
app.use('/api/settings', require('./routes/settings'));
```

- [ ] **Step 4: Restart backend, verifikasi**

Restart backend. Test:
```
GET http://localhost:5000/api/settings/signature
Authorization: Bearer <token>
```
Expected: 404 dengan `{ "message": "Tanda tangan belum diupload" }` (karena belum ada file).

- [ ] **Step 5: Commit**

Bukan git repo — skip commit.

---

### Task 2: Update htmlGenerator — Toolbar + Signature + PDF

**Files:**
- Modify: `backend/src/utils/htmlGenerator.js`

**Konteks penting:**
- File ada di `c:/xampp/htdocs/sistem_ilena/backend/src/utils/htmlGenerator.js`
- File berisi 3 fungsi: `generateHTMLSuratJalan`, `generateHTMLSuratPengantar`, `generateHTMLInvoice`
- Semua dokumen sudah menggunakan `.page` sebagai wrapper (hasil Task sebelumnya)
- Token diambil dari URL: `new URLSearchParams(window.location.search).get('token')`
- html2pdf.js digunakan dari CDN untuk export PDF
- Signature overlay ada di dalam `.page` (ikut ter-capture html2pdf)
- Toolbar ada di luar `.page` (tidak ter-capture, hidden saat print)

**Perubahan yang diperlukan per generator:**

1. Hapus `onload="setTimeout(() => window.print(), 300)"` dari `<body>` tag
2. Tambah `position: relative` ke CSS `.page`
3. Tambah CSS toolbar dan signature
4. Tambah script html2pdf.js dari CDN
5. Tambah HTML toolbar di atas `.page`
6. Untuk SJ dan SP: tambah signature overlay di dalam `.page` + full JS
7. Untuk Invoice: hanya toolbar Cetak + Simpan PDF (tanpa signature)

- [ ] **Step 1: Definisikan shared helper strings di awal file (sebelum semua fungsi)**

Tambahkan setelah baris `dayjs.locale('id');` dan sebelum `const formatRupiah`:

```js
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
    .tb-btn-ghost {
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.85);
    }
    .tb-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.14); }
    .tb-btn-primary {
        background: #2563eb;
        color: #fff;
    }
    .tb-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .tb-btn-success {
        background: #16a34a;
        color: #fff;
    }
    .tb-btn-success:hover { background: #15803d; }
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
    .tb-status {
        font-size: 11px;
        color: rgba(255,255,255,0.45);
        margin-left: 4px;
    }
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

    // ── Fetch existing signature ──
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

    // ── Upload signature ──
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
        .then(function(data) {
            tbStatus.textContent = 'TTD disimpan';
            sigImg.src = apiBase + '/api/settings/signature?token=' + token + '&t=' + Date.now();
            btnAddSig.disabled = false;
        })
        .catch(function() { tbStatus.textContent = 'Upload gagal'; });
    });

    // ── Add signature to page ──
    btnAddSig.addEventListener('click', function() {
        overlay.style.display = 'block';
        overlay.style.left = '30mm';
        overlay.style.top = '200mm';
        overlay.style.width = '120px';
        overlay.style.height = '70px';
    });

    // ── Delete signature from page ──
    document.getElementById('sigDeleteBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        overlay.style.display = 'none';
    });

    // ── Drag & resize ──
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

    // ── Print ──
    document.getElementById('btnPrint').addEventListener('click', function() {
        window.print();
    });

    // ── Save PDF ──
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
    document.getElementById('btnPrint').addEventListener('click', function() {
        window.print();
    });
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
```

- [ ] **Step 2: Update `generateHTMLSuratJalan`**

**2a.** Di CSS `generateHTMLSuratJalan` — tambah `position: relative` ke `.page`. Cari:
```css
    .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 14mm;
        background: #fff;
        box-shadow: 0 1px 8px rgba(0,0,0,0.12);
    }
```
Ganti dengan:
```css
    .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 14mm;
        background: #fff;
        box-shadow: 0 1px 8px rgba(0,0,0,0.12);
        position: relative;
    }
```

**2b.** Tambah `\${TOOLBAR_CSS}` di dalam `<style>` block, tepat sebelum tag penutup `</style>`. Cari:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    </style>
</head>
<body onload="setTimeout(() => window.print(), 300)">
    <div class="page">
```
Ganti dengan:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    \${TOOLBAR_CSS}
    </style>
</head>
<body>
    \${TOOLBAR_HTML_FULL}
    <div class="page">
        \${SIG_OVERLAY_HTML}
```

**2c.** Tambah JS sebelum `</body>` di SJ. Cari:
```
</body>
</html>
  `;
};

const generateHTMLSuratPengantar
```
Ganti dengan:
```
    \${buildFullToolbarJS('surat-jalan-' + (sj.nomor_surat || 'dokumen') + '.pdf')}
</body>
</html>
  `;
};

const generateHTMLSuratPengantar
```

- [ ] **Step 3: Update `generateHTMLSuratPengantar`**

Sama persis dengan Step 2 — lakukan 3 perubahan yang sama:

**3a.** Tambah `position: relative` ke CSS `.page` di SP:
```css
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); }
```
Ganti dengan:
```css
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
```

**3b.** Tambah toolbar di body SP. Cari:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    </style>
</head>
<body onload="setTimeout(() => window.print(), 300)">
    <div class="page">
        <!-- Header -->
        <div class="d-flex justify-content-between my-4">
```
Ganti dengan:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
    }
    \${TOOLBAR_CSS}
    </style>
</head>
<body>
    \${TOOLBAR_HTML_FULL}
    <div class="page">
        \${SIG_OVERLAY_HTML}
        <!-- Header -->
        <div class="d-flex justify-content-between my-4">
```

**3c.** Tambah JS sebelum `</body>` di SP. Cari:
```
</body>
</html>
  `;
};

const generateHTMLInvoice
```
Ganti dengan:
```
    \${buildFullToolbarJS('surat-pengantar-' + (sp.nomor_sp || 'dokumen') + '.pdf')}
</body>
</html>
  `;
};

const generateHTMLInvoice
```

- [ ] **Step 4: Update `generateHTMLInvoice`**

**4a.** Tambah `position: relative` ke CSS `.page` di Invoice:
```css
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); }
```
Ganti dengan:
```css
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.12); position: relative; }
```

**4b.** Tambah toolbar di body Invoice. Cari:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img, .kotak-pembayaran { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
        .print-lunas { position: fixed !important; z-index: 2147483647 !important; }
        .kotak-pembayaran { border: 1px dashed #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    </style>
</head>
<body onload="setTimeout(() => window.print(), 300)">
    ${lunasWatermark}
    <div class="page">
```
Ganti dengan:
```
    @page { size: A4 portrait; margin: 14mm; }
    @media print {
        html, body { background: #fff !important; }
        .page { width: 100% !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        a[href]:after { content: ""; }
        tr, img, .kotak-pembayaran { break-inside: avoid; }
        .table-striped>tbody>tr:nth-of-type(odd)>* { --bs-table-accent-bg: transparent; }
        .print-lunas { position: fixed !important; z-index: 2147483647 !important; }
        .kotak-pembayaran { border: 1px dashed #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    \${TOOLBAR_CSS}
    </style>
</head>
<body>
    \${TOOLBAR_HTML_SIMPLE}
    ${lunasWatermark}
    <div class="page">
```

**4c.** Tambah JS sebelum `</body>` di Invoice. Cari:
```
</body>
</html>
  `;
};

module.exports = {
```
Ganti dengan:
```
    \${buildSimpleToolbarJS('invoice-' + (inv.nomor_invoice || 'dokumen') + '.pdf')}
</body>
</html>
  `;
};

module.exports = {
```

- [ ] **Step 5: Restart backend dan verifikasi di browser**

Restart backend. Buka salah satu Surat Jalan di browser:
- Toolbar dark muncul di atas halaman
- Dokumen tampil sebagai A4 di bawah toolbar
- Klik "Cetak" → dialog print terbuka
- Klik "Upload TTD" → pilih gambar → status berubah "TTD tersedia"
- Klik "+ Tambah ke Dokumen" → signature muncul, bisa di-drag dan di-resize
- Klik "Simpan PDF" → file PDF ter-download

- [ ] **Step 6: Commit**

Bukan git repo — skip commit.
