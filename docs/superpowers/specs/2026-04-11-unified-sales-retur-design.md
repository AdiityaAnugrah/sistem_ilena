# Design Spec: Unified Sales List & Retur Barang Interior
**Date:** 2026-04-11  
**Status:** Approved

---

## Feature 1 — Unified Sales List

### Tujuan
Menampilkan semua penjualan (offline tipe PENJUALAN + interior) dalam satu halaman dengan filter lengkap.

### Backend

**Endpoint:** `GET /api/penjualan/semua`  
**File baru:** `backend/src/routes/penjualan.js`  
**Daftarkan di:** `backend/src/app.js` → `app.use('/api/penjualan', require('./routes/penjualan'))`

Query: UNION antara `penjualan_offline` (tipe=PENJUALAN) dan `penjualan_interior`, dieksekusi via raw query Sequelize karena dua tabel berbeda.

**Format response per item (dinormalisasi):**
```json
{
  "id": 1,
  "sumber": "OFFLINE",
  "tanggal": "2026-04-10",
  "nama_customer": "Budi Santoso",
  "no_po": "PO-001",
  "faktur": "FAKTUR",
  "status": "ACTIVE",
  "jumlah_item": 3,
  "created_at": "2026-04-10T08:00:00Z"
}
```

**Query parameters (semua opsional):**
| Param | Tipe | Deskripsi |
|---|---|---|
| search | string | Cari nama customer atau no_po (LIKE) |
| sumber | OFFLINE \| INTERIOR | Filter berdasarkan asal data |
| status | DRAFT \| ACTIVE \| COMPLETED | Filter status |
| faktur | FAKTUR \| NON_FAKTUR | Filter faktur |
| tanggal_dari | YYYY-MM-DD | Batas awal tanggal |
| tanggal_sampai | YYYY-MM-DD | Batas akhir tanggal |
| page | integer | Default 1 |
| limit | integer | Default 20 |

**Response:**
```json
{
  "data": [...],
  "total": 85,
  "page": 1,
  "totalPages": 5
}
```

**Implementasi UNION:**
```sql
SELECT id, 'OFFLINE' AS sumber, tanggal, nama_penerima AS nama_customer,
       no_po, faktur, status, created_at,
       (SELECT COUNT(*) FROM penjualan_offline_items WHERE penjualan_offline_id = po.id) AS jumlah_item
FROM penjualan_offline po WHERE tipe = 'PENJUALAN' [+ WHERE filters]

UNION ALL

SELECT id, 'INTERIOR' AS sumber, tanggal, nama_customer,
       no_po, faktur, status, created_at,
       (SELECT COUNT(*) FROM penjualan_interior_items WHERE penjualan_interior_id = pi.id) AS jumlah_item
FROM penjualan_interior pi [+ WHERE filters]

ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

Total count dihitung dengan query COUNT terpisah (UNION ALL dari dua COUNT).

### Frontend

**Halaman:** `frontend/src/app/dashboard/penjualan/page.tsx`

**Kolom tabel:**
| Kolom | Data |
|---|---|
| Tanggal | `tanggal` (format DD MMM YYYY) |
| Nama Customer | `nama_customer` |
| No. PO | `no_po` (tampilkan `-` jika null) |
| Sumber | Badge: `OFFLINE` (biru) / `INTERIOR` (ungu) |
| Faktur | Badge: `Faktur` / `Non Faktur` |
| Status | Badge: Draft / Aktif / Selesai |
| Jumlah Item | `jumlah_item` |
| Aksi | Tombol "Detail" → navigate ke halaman detail sesuai sumber |

**Navigasi dari tombol Detail:**
- Sumber OFFLINE → `/dashboard/penjualan/offline/[id]`
- Sumber INTERIOR → `/dashboard/penjualan/interior/[id]`

**Filter bar:**
- Input search (nama customer / no PO) + tombol Cari
- Pill filter: Semua / Offline / Interior
- Pill filter: Semua Status / Draft / Aktif / Selesai
- Pill filter: Semua / Faktur / Non Faktur
- Date range: input tanggal dari + sampai

**Sidebar:** Tambahkan menu "Semua Penjualan" di atas atau di bawah menu Offline/Interior yang sudah ada.

---

## Feature 2 — Retur Barang Interior

### Tujuan
Mencatat bahwa sebagian item yang dikirim via Surat Jalan dikembalikan (reject) oleh customer, mengurangi `sudah_kirim` agar sisa bisa dikirim ulang via SJ baru.

### Database

**Tabel baru:** `retur_sj_interior`
```sql
CREATE TABLE IF NOT EXISTS retur_sj_interior (
  id INT AUTO_INCREMENT PRIMARY KEY,
  surat_jalan_interior_id INT NOT NULL,
  penjualan_interior_item_id INT NOT NULL,
  qty_retur INT NOT NULL,
  tanggal DATE NOT NULL,
  catatan TEXT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (surat_jalan_interior_id) REFERENCES surat_jalan_interior(id),
  FOREIGN KEY (penjualan_interior_item_id) REFERENCES penjualan_interior_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Backend

**Model baru:** `backend/src/models/ReturSJInterior.js`

**Associations baru (di models/index.js):**
- `SuratJalanInterior.hasMany(ReturSJInterior, { foreignKey: 'surat_jalan_interior_id', as: 'returs' })`
- `ReturSJInterior.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' })`
- `ReturSJInterior.belongsTo(PenjualanInteriorItem, { foreignKey: 'penjualan_interior_item_id', as: 'item' })`

**Endpoint baru:** `POST /api/penjualan-interior/:id/retur-sj`  
(ditambahkan ke `backend/src/routes/penjualanInterior.js`)

**Request body:**
```json
{
  "surat_jalan_interior_id": 1,
  "tanggal": "2026-04-11",
  "catatan": "2 item reject, cat lecet",
  "items": [
    { "penjualan_interior_item_id": 1, "qty_retur": 2 }
  ]
}
```

**Logic (dalam satu DB transaction):**
1. Validasi: `surat_jalan_interior_id` harus milik penjualan ini
2. Per item: ambil `SuratJalanInteriorItem` untuk item tersebut pada SJ tersebut, pastikan `qty_retur ≤ qty_kirim`
3. Insert record ke `retur_sj_interior`
4. Update `PenjualanInteriorItem.sudah_kirim -= qty_retur`
5. Log activity: `CATAT_RETUR_SJ_INTERIOR`

**Validasi error:**
- `qty_retur > qty_kirim` → 400 "Qty retur melebihi qty kirim pada SJ ini"
- `qty_retur <= 0` → 400 "Qty retur harus lebih dari 0"
- SJ tidak milik penjualan ini → 400

**Update `fullInclude` di GET /:id:** tambahkan `ReturSJInterior` di dalam include `SuratJalanInterior`:
```js
{
  model: SuratJalanInterior, as: 'suratJalans',
  include: [
    { model: SuratJalanInteriorItem, as: 'items' },
    { model: ReturSJInterior, as: 'returs' },  // NEW
  ]
}
```

### Frontend

**Halaman:** `frontend/src/app/dashboard/penjualan/interior/[id]/page.tsx`

Pada setiap kartu SJ yang ditampilkan, tambahkan:
1. **Tombol "Catat Retur"** — muncul hanya jika SJ sudah ada (bukan di-draft)
2. **Form retur (inline/modal):** daftar item SJ + input qty retur per item + tanggal + catatan
3. **History retur:** di bawah kartu SJ, tampilkan list retur yang sudah dicatat:
   - Tanggal retur, nama barang, qty retur, catatan

**Validasi UI:**
- qty retur tidak boleh melebihi qty kirim pada SJ tersebut
- qty retur tidak boleh 0 atau negatif

**Efek visual setelah retur:** kolom "Sudah Kirim" pada item terupdate, sehingga terlihat sisa yang masih bisa dikirim via SJ baru.

---

## Urutan Implementasi yang Disarankan

1. Feature 2 backend (DB + model + endpoint) — tidak ada dependensi UI
2. Feature 2 frontend (detail interior page update)
3. Feature 1 backend (endpoint UNION)
4. Feature 1 frontend (halaman baru + sidebar)
