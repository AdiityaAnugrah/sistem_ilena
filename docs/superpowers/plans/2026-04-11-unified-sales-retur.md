# Unified Sales List & Retur Barang Interior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fitur retur barang pada penjualan interior (dengan tracking DB), dan buat halaman unified list yang menggabungkan semua penjualan offline + interior.

**Architecture:** Feature 2 (retur) menambah tabel `retur_sj_interior`, model, endpoint POST, dan UI modal di detail interior. Feature 1 (unified list) menambah endpoint raw SQL UNION di route baru, halaman Next.js baru, dan entry sidebar.

**Tech Stack:** Node.js + Express + Sequelize (backend), Next.js App Router + TypeScript + Tailwind (frontend), MySQL.

---

## Task 1: Buat Tabel & Model ReturSJInterior

**Files:**
- Modify: `backend/src/config/migration.sql`
- Create: `backend/src/models/ReturSJInterior.js`
- Modify: `backend/src/models/index.js`

- [ ] **Step 1: Jalankan ALTER TABLE di DB**

```bash
cd backend && node -e "
const sequelize = require('./src/config/database');
(async () => {
  await sequelize.authenticate();
  await sequelize.query(\`
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
    )
  \`);
  console.log('OK');
  process.exit(0);
})();
"
```

Expected output: `OK`

- [ ] **Step 2: Tambah ke migration.sql** (setelah blok `surat_jalan_interior_items`)

```sql
-- Retur Surat Jalan Interior
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

- [ ] **Step 3: Buat file `backend/src/models/ReturSJInterior.js`**

```js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturSJInterior = sequelize.define('retur_sj_interior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  surat_jalan_interior_id: { type: DataTypes.INTEGER, allowNull: false },
  penjualan_interior_item_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_retur: { type: DataTypes.INTEGER, allowNull: false },
  tanggal: { type: DataTypes.DATEONLY, allowNull: false },
  catatan: { type: DataTypes.TEXT, defaultValue: null },
  created_by: { type: DataTypes.INTEGER },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ReturSJInterior;
```

- [ ] **Step 4: Register di `backend/src/models/index.js`**

Tambah import setelah baris import terakhir (sebelum associations):
```js
const ReturSJInterior = require('./ReturSJInterior');
```

Tambah associations setelah blok SuratJalanInterior–InvoiceInterior:
```js
// ReturSJInterior associations
SuratJalanInterior.hasMany(ReturSJInterior, { foreignKey: 'surat_jalan_interior_id', as: 'returs' });
ReturSJInterior.belongsTo(SuratJalanInterior, { foreignKey: 'surat_jalan_interior_id', as: 'suratJalan' });
ReturSJInterior.belongsTo(PenjualanInteriorItem, { foreignKey: 'penjualan_interior_item_id', as: 'item' });
```

Tambah `ReturSJInterior` ke `module.exports`:
```js
module.exports = {
  // ... existing exports
  ReturSJInterior,
};
```

- [ ] **Step 5: Verifikasi model load tanpa error**

```bash
cd backend && node -e "
const { ReturSJInterior } = require('./src/models');
console.log('Model OK:', ReturSJInterior.tableName);
process.exit(0);
"
```

Expected output: `Model OK: retur_sj_interior`

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/migration.sql backend/src/models/ReturSJInterior.js backend/src/models/index.js
git commit -m "feat: tambah model dan tabel retur_sj_interior"
```

---

## Task 2: Endpoint POST Retur SJ Interior

**Files:**
- Modify: `backend/src/routes/penjualanInterior.js`

- [ ] **Step 1: Tambah `ReturSJInterior` dan `SuratJalanInteriorItem` ke destructure import di atas file**

Baris import models yang ada:
```js
const {
  PenjualanInterior, PenjualanInteriorItem, ProformaInvoice, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, InvoiceInterior,
} = require('../models');
```

Ganti menjadi:
```js
const {
  PenjualanInterior, PenjualanInteriorItem, ProformaInvoice, PembayaranInterior,
  SuratJalanInterior, SuratJalanInteriorItem, InvoiceInterior, ReturSJInterior,
} = require('../models');
```

- [ ] **Step 2: Update `fullInclude` agar GET /:id ikut sertakan returs**

Temukan `fullInclude` di atas file, ubah bagian `SuratJalanInterior`:
```js
const fullInclude = [
  { model: PenjualanInteriorItem, as: 'items' },
  { model: ProformaInvoice, as: 'proformas' },
  { model: PembayaranInterior, as: 'pembayarans' },
  {
    model: SuratJalanInterior, as: 'suratJalans',
    include: [
      { model: SuratJalanInteriorItem, as: 'items' },
      { model: ReturSJInterior, as: 'returs',
        include: [{ model: PenjualanInteriorItem, as: 'item' }] },
    ],
  },
  { model: InvoiceInterior, as: 'invoices' },
];
```

- [ ] **Step 3: Tambah endpoint POST retur-sj (sebelum `module.exports`)**

```js
// POST /api/penjualan-interior/:id/retur-sj
router.post('/:id/retur-sj', authenticate, async (req, res) => {
  try {
    const penjualan = await PenjualanInterior.findByPk(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const { surat_jalan_interior_id, tanggal, catatan, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 item harus diisi' });
    }

    const sequelizeDb = require('../config/database');
    const t = await sequelizeDb.transaction();

    try {
      // Validasi SJ milik penjualan ini
      const sj = await SuratJalanInterior.findOne({
        where: { id: surat_jalan_interior_id, penjualan_interior_id: penjualan.id },
        transaction: t,
      });
      if (!sj) throw new Error('Surat Jalan tidak ditemukan atau bukan milik penjualan ini');

      for (const reqItem of items) {
        const { penjualan_interior_item_id, qty_retur } = reqItem;
        const qtyRetur = parseInt(qty_retur, 10);

        if (!qtyRetur || qtyRetur <= 0) throw new Error('Qty retur harus lebih dari 0');

        // Cek qty_kirim pada SJ ini untuk item ini
        const sjItem = await SuratJalanInteriorItem.findOne({
          where: { surat_jalan_interior_id, penjualan_interior_item_id },
          transaction: t,
        });
        if (!sjItem) throw new Error(`Item ID ${penjualan_interior_item_id} tidak ada di SJ ini`);
        if (qtyRetur > sjItem.qty_kirim) {
          throw new Error(`Qty retur (${qtyRetur}) melebihi qty kirim (${sjItem.qty_kirim}) pada SJ ini`);
        }

        // Insert retur record
        await ReturSJInterior.create({
          surat_jalan_interior_id,
          penjualan_interior_item_id,
          qty_retur: qtyRetur,
          tanggal: tanggal || new Date().toISOString().split('T')[0],
          catatan: catatan || null,
          created_by: req.user.id,
        }, { transaction: t });

        // Kurangi sudah_kirim
        const piItem = await PenjualanInteriorItem.findByPk(penjualan_interior_item_id, { transaction: t });
        if (piItem) {
          await piItem.update({ sudah_kirim: Math.max(0, piItem.sudah_kirim - qtyRetur) }, { transaction: t });
        }
      }

      await t.commit();
      await logAction(req.user.id, 'CATAT_RETUR_SJ_INTERIOR',
        `SJ ID: ${surat_jalan_interior_id}, Penjualan ID: ${penjualan.id}`, req.ip);

      return res.status(201).json({ message: 'Retur berhasil dicatat' });
    } catch (err) {
      await t.rollback();
      return res.status(400).json({ message: err.message });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});
```

- [ ] **Step 4: Verifikasi server restart tanpa error**

Restart backend server, pastikan tidak ada error di console.

- [ ] **Step 5: Test endpoint via curl**

```bash
curl -X POST http://localhost:5000/api/penjualan-interior/1/retur-sj \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "surat_jalan_interior_id": 1,
    "tanggal": "2026-04-11",
    "catatan": "2 item reject",
    "items": [{ "penjualan_interior_item_id": 1, "qty_retur": 1 }]
  }'
```

Expected: `{"message":"Retur berhasil dicatat"}`

Verifikasi `sudah_kirim` berkurang:
```bash
curl http://localhost:5000/api/penjualan-interior/1 \
  -H "Authorization: Bearer <token>" | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const j=JSON.parse(d);
j.items.forEach(i=>console.log(i.nama_barang, 'sudah_kirim:', i.sudah_kirim));
"
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/penjualanInterior.js
git commit -m "feat: endpoint retur sj interior dengan pengurangan sudah_kirim"
```

---

## Task 3: UI Retur di Detail Interior Page

**Files:**
- Modify: `frontend/src/app/dashboard/penjualan/interior/[id]/page.tsx`

- [ ] **Step 1: Tambah state untuk retur modal**

Di dalam komponen utama, cari blok `const [modal, setModal]` dan tambah state retur di bawahnya:
```tsx
const [returSjId, setReturSjId] = useState<number | null>(null);
const [returTanggal, setReturTanggal] = useState(new Date().toISOString().split('T')[0]);
const [returCatatan, setReturCatatan] = useState('');
const [returItems, setReturItems] = useState<Record<number, number>>({}); // penjualan_interior_item_id → qty_retur
```

- [ ] **Step 2: Tambah fungsi openReturModal dan submitRetur**

Tambah setelah fungsi-fungsi create yang sudah ada (createProforma, createPembayaran, dll):
```tsx
const openReturModal = (sj: any) => {
  setReturSjId(sj.id);
  // Pre-fill items dari SJ ini dengan qty 0
  const init: Record<number, number> = {};
  (sj.items || []).forEach((item: any) => {
    init[item.penjualan_interior_item_id] = 0;
  });
  setReturItems(init);
  setReturTanggal(new Date().toISOString().split('T')[0]);
  setReturCatatan('');
  setModal('retur-sj');
};

const submitRetur = async () => {
  const itemsPayload = Object.entries(returItems)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ penjualan_interior_item_id: Number(id), qty_retur: qty }));

  if (itemsPayload.length === 0) {
    toast.error('Isi minimal 1 qty retur');
    return;
  }
  setDocLoading(true);
  try {
    await api.post(`/penjualan-interior/${id}/retur-sj`, {
      surat_jalan_interior_id: returSjId,
      tanggal: returTanggal,
      catatan: returCatatan,
      items: itemsPayload,
    });
    toast.success('Retur berhasil dicatat');
    setModal(null);
    fetchData();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Gagal mencatat retur');
  } finally {
    setDocLoading(false);
  }
};
```

- [ ] **Step 3: Update render kartu SJ — tambah tombol Catat Retur dan history retur**

Temukan blok `{data.suratJalans.map((sj: any) => (` dan ganti seluruh `<DocItem ... />` dengan:

```tsx
{data.suratJalans.map((sj: any) => (
  <div key={sj.id} className="space-y-2">
    <div className="flex items-center justify-between p-3 rounded-xl"
      style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
      <div>
        <div className="text-xs font-mono font-medium" style={{ color: '#334155' }}>{sj.nomor_surat}</div>
        <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(sj.tanggal)}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => openReturModal(sj)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#fff', color: '#f59e0b', border: '1px solid #fde68a' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbeb'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          Catat Retur
        </button>
        <button
          onClick={() => printDoc('surat-jalan-interior', sj.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#fff1f2';
            (e.currentTarget as HTMLElement).style.color = '#f43f5e';
            (e.currentTarget as HTMLElement).style.border = '1px solid #fecdd3';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#fff';
            (e.currentTarget as HTMLElement).style.color = '#475569';
            (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
          }}
        >
          <Printer className="h-3.5 w-3.5" />
          Cetak
        </button>
      </div>
    </div>
    {/* History retur */}
    {sj.returs && sj.returs.length > 0 && (
      <div className="ml-3 space-y-1">
        {sj.returs.map((r: any) => (
          <div key={r.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
            style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <div className="flex-1">
              <div className="text-xs font-semibold" style={{ color: '#c2410c' }}>
                Retur {r.qty_retur} pcs — {r.item?.nama_barang || '-'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9a3412' }}>
                {formatDate(r.tanggal)}{r.catatan ? ` · ${r.catatan}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
))}
```

- [ ] **Step 4: Tambah Modal Retur SJ (setelah modal invoice-interior yang sudah ada)**

```tsx
{/* ── Modal Retur SJ ── */}
<ModalWrapper show={modal === 'retur-sj'} onClose={() => setModal(null)}>
  <ModalHeader icon={Truck} title="Catat Retur Barang" sub="Kurangi sudah kirim untuk item yang dikembalikan" />
  <div className="space-y-3 px-5 pb-2">
    <ModalInput label="Tanggal Retur" type="date" value={returTanggal}
      onChange={(e: any) => setReturTanggal(e.target.value)} />
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: '#64748b' }}>Qty Retur per Item</div>
      {data?.suratJalans?.find((sj: any) => sj.id === returSjId)?.items?.map((sjItem: any) => {
        const piItem = data.items?.find((i: any) => i.id === sjItem.penjualan_interior_item_id);
        return (
          <div key={sjItem.penjualan_interior_item_id}
            className="flex items-center justify-between py-2 border-b last:border-0"
            style={{ borderColor: '#f1f5f9' }}>
            <div className="text-xs" style={{ color: '#1e293b' }}>
              <div className="font-medium">{piItem?.nama_barang || '-'}</div>
              <div style={{ color: '#94a3b8' }}>Kirim: {sjItem.qty_kirim} pcs</div>
            </div>
            <input
              type="number" min={0} max={sjItem.qty_kirim}
              value={returItems[sjItem.penjualan_interior_item_id] || 0}
              onChange={e => setReturItems(prev => ({
                ...prev,
                [sjItem.penjualan_interior_item_id]: Math.min(sjItem.qty_kirim, Math.max(0, Number(e.target.value))),
              }))}
              className="w-20 text-center border rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:border-rose-400"
              style={{ borderColor: '#e2e8f0', color: '#1e293b' }}
            />
          </div>
        );
      })}
    </div>
    <ModalInput label="Catatan (opsional)" value={returCatatan}
      onChange={(e: any) => setReturCatatan(e.target.value)}
      placeholder="Alasan retur..." />
  </div>
  <ModalFooter onClose={() => setModal(null)} onSubmit={submitRetur} loading={docLoading} label="Simpan Retur" />
</ModalWrapper>
```

- [ ] **Step 5: Verifikasi di browser**

Buka halaman detail penjualan interior yang punya SJ. Pastikan:
- Tombol "Catat Retur" muncul di setiap kartu SJ
- Klik tombol → modal muncul dengan daftar item + input qty
- Submit → toast sukses, `sudah_kirim` item berkurang, history retur muncul di bawah kartu SJ

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/penjualan/interior/\[id\]/page.tsx
git commit -m "feat: ui catat retur barang pada detail penjualan interior"
```

---

## Task 4: Backend Endpoint Unified Sales List

**Files:**
- Create: `backend/src/routes/penjualan.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Buat `backend/src/routes/penjualan.js`**

```js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

// GET /api/penjualan/semua
router.get('/semua', authenticate, async (req, res) => {
  try {
    const {
      search, sumber, status, faktur,
      tanggal_dari, tanggal_sampai,
      page = 1, limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const lim = parseInt(limit);

    // Build WHERE clause per sumber
    const offlineWhere = ['po.tipe = "PENJUALAN"'];
    const interiorWhere = [];
    const replacements = [];

    if (search) {
      offlineWhere.push('(po.nama_penerima LIKE ? OR po.no_po LIKE ?)');
      interiorWhere.push('(pi.nama_customer LIKE ? OR pi.no_po LIKE ?)');
      const like = `%${search}%`;
      replacements.push(like, like, like, like);
    }
    if (status) {
      offlineWhere.push('po.status = ?');
      interiorWhere.push('pi.status = ?');
      replacements.push(status, status);
    }
    if (faktur) {
      offlineWhere.push('po.faktur = ?');
      interiorWhere.push('pi.faktur = ?');
      replacements.push(faktur, faktur);
    }
    if (tanggal_dari) {
      offlineWhere.push('po.tanggal >= ?');
      interiorWhere.push('pi.tanggal >= ?');
      replacements.push(tanggal_dari, tanggal_dari);
    }
    if (tanggal_sampai) {
      offlineWhere.push('po.tanggal <= ?');
      interiorWhere.push('pi.tanggal <= ?');
      replacements.push(tanggal_sampai, tanggal_sampai);
    }

    const offlineWhereSQL = offlineWhere.length ? `WHERE ${offlineWhere.join(' AND ')}` : '';
    const interiorWhereSQL = interiorWhere.length ? `WHERE ${interiorWhere.join(' AND ')}` : '';

    // Exclude sumber filter tertentu
    const includeOffline = !sumber || sumber === 'OFFLINE';
    const includeInterior = !sumber || sumber === 'INTERIOR';

    // Build UNION parts
    const parts = [];
    const countParts = [];

    if (includeOffline) {
      parts.push(`
        SELECT po.id, 'OFFLINE' AS sumber, po.tanggal,
               po.nama_penerima AS nama_customer, po.no_po,
               po.faktur, po.status, po.created_at,
               (SELECT COUNT(*) FROM penjualan_offline_items WHERE penjualan_offline_id = po.id) AS jumlah_item
        FROM penjualan_offline po
        ${offlineWhereSQL}
      `);
      countParts.push(`SELECT COUNT(*) AS cnt FROM penjualan_offline po ${offlineWhereSQL}`);
    }

    if (includeInterior) {
      parts.push(`
        SELECT pi.id, 'INTERIOR' AS sumber, pi.tanggal,
               pi.nama_customer, pi.no_po,
               pi.faktur, pi.status, pi.created_at,
               (SELECT COUNT(*) FROM penjualan_interior_items WHERE penjualan_interior_id = pi.id) AS jumlah_item
        FROM penjualan_interior pi
        ${interiorWhereSQL}
      `);
      countParts.push(`SELECT COUNT(*) AS cnt FROM penjualan_interior pi ${interiorWhereSQL}`);
    }

    if (parts.length === 0) {
      return res.json({ data: [], total: 0, page: parseInt(page), totalPages: 0 });
    }

    const unionSQL = `(${parts.join(') UNION ALL (')}) ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countSQL = `SELECT SUM(cnt) AS total FROM (${countParts.join(' UNION ALL ')}) AS counts`;

    // Execute data + count in parallel
    const [rows] = await sequelize.query(unionSQL, {
      replacements: [...replacements, lim, offset],
      type: sequelize.QueryTypes.SELECT,
    });

    const [countResult] = await sequelize.query(countSQL, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    // sequelize.query with SELECT returns array of rows; rows might be array or single object
    const dataRows = Array.isArray(rows) ? rows : [rows].filter(Boolean);
    const total = parseInt(countResult?.total || 0);

    return res.json({
      data: dataRows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / lim),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register route di `backend/src/app.js`**

Tambah baris setelah `app.use('/api/auth', ...)`:
```js
app.use('/api/penjualan', require('./routes/penjualan'));
```

- [ ] **Step 3: Verifikasi endpoint**

```bash
curl "http://localhost:5000/api/penjualan/semua?limit=5" \
  -H "Authorization: Bearer <token>"
```

Expected: JSON dengan `data` array berisi campuran OFFLINE dan INTERIOR, field `sumber`, `nama_customer`, `jumlah_item`, dll.

```bash
# Test filter sumber
curl "http://localhost:5000/api/penjualan/semua?sumber=INTERIOR" \
  -H "Authorization: Bearer <token>"
```

Expected: hanya data dengan `sumber: "INTERIOR"`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/penjualan.js backend/src/app.js
git commit -m "feat: endpoint unified sales list GET /api/penjualan/semua"
```

---

## Task 5: Halaman Frontend Unified Sales List

**Files:**
- Create: `frontend/src/app/dashboard/penjualan/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Buat `frontend/src/app/dashboard/penjualan/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Search, ShoppingBag } from 'lucide-react';

const SumberBadge = ({ sumber }: { sumber: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    sumber === 'OFFLINE'
      ? 'bg-blue-50 text-blue-700 border border-blue-100'
      : 'bg-purple-50 text-purple-700 border border-purple-100'
  }`}>
    {sumber === 'OFFLINE' ? 'Offline' : 'Interior'}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:     { label: 'Draft',    cls: 'badge-draft' },
    ACTIVE:    { label: 'Aktif',    cls: 'badge-active' },
    COMPLETED: { label: 'Selesai', cls: 'badge-completed' },
  };
  const s = map[status] || { label: status, cls: 'badge-draft' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const FakturBadge = ({ faktur }: { faktur: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    faktur === 'FAKTUR' ? 'badge-faktur' : 'badge-nonfaktur'
  }`}>
    {faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}
  </span>
);

const SkeletonRow = () => (
  <tr>{Array.from({ length: 8 }).map((_, i) => (
    <td key={i} className="px-5 py-4"><div className="skeleton h-4 rounded" style={{ width: '80px' }} /></td>
  ))}</tr>
);

const PILL_SUMBER = [
  { key: '', label: 'Semua' },
  { key: 'OFFLINE', label: 'Offline' },
  { key: 'INTERIOR', label: 'Interior' },
];
const PILL_STATUS = [
  { key: '', label: 'Semua Status' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ACTIVE', label: 'Aktif' },
  { key: 'COMPLETED', label: 'Selesai' },
];
const PILL_FAKTUR = [
  { key: '', label: 'Semua' },
  { key: 'FAKTUR', label: 'Faktur' },
  { key: 'NON_FAKTUR', label: 'Non Faktur' },
];

export default function SemuaPenjualanPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sumber, setSumber] = useState('');
  const [status, setStatus] = useState('');
  const [faktur, setFaktur] = useState('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = async (overrides: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        search, sumber, status, faktur,
        tanggal_dari: tanggalDari, tanggal_sampai: tanggalSampai,
        page, limit: 20,
        ...overrides,
      };
      // Hapus key kosong
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });

      const res = await api.get('/penjualan/semua', { params });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, sumber, status, faktur]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData({ page: 1 });
  };

  const setPill = (setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  const detailHref = (row: any) =>
    row.sumber === 'OFFLINE'
      ? `/dashboard/penjualan/offline/${row.id}`
      : `/dashboard/penjualan/interior/${row.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0f172a' }}>Semua Penjualan</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{total} total transaksi</p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
        {/* Filter bar */}
        <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
          {/* Row 1: Sumber + Status + Faktur pills */}
          <div className="flex flex-wrap gap-2">
            {PILL_SUMBER.map(p => (
              <button key={p.key} onClick={() => setPill(setSumber, p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={sumber === p.key
                  ? { background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', boxShadow: '0 2px 8px rgba(244,63,94,0.25)' }
                  : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                {p.label}
              </button>
            ))}
            <div className="w-px mx-1" style={{ background: '#e2e8f0' }} />
            {PILL_STATUS.map(p => (
              <button key={p.key} onClick={() => setPill(setStatus, p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={status === p.key
                  ? { background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', boxShadow: '0 2px 8px rgba(244,63,94,0.25)' }
                  : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                {p.label}
              </button>
            ))}
            <div className="w-px mx-1" style={{ background: '#e2e8f0' }} />
            {PILL_FAKTUR.map(p => (
              <button key={p.key} onClick={() => setPill(setFaktur, p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={faktur === p.key
                  ? { background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', boxShadow: '0 2px 8px rgba(244,63,94,0.25)' }
                  : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Row 2: Date range + search */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={tanggalDari} onChange={e => setTanggalDari(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border outline-none"
              style={{ border: '1px solid #e2e8f0', color: '#475569' }} />
            <span className="text-xs" style={{ color: '#94a3b8' }}>s/d</span>
            <input type="date" value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border outline-none"
              style={{ border: '1px solid #e2e8f0', color: '#475569' }} />
            <button onClick={() => { setTanggalDari(''); setTanggalSampai(''); setPage(1); fetchData({ tanggal_dari: '', tanggal_sampai: '', page: 1 }); }}
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: '#f1f5f9', color: '#64748b' }}>
              Reset
            </button>
            <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <input type="text" placeholder="Cari nama, no. PO..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm rounded-lg outline-none"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', width: '220px' }}
                  onFocus={e => (e.target as HTMLElement).style.border = '1px solid #f43f5e'}
                  onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'} />
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                Cari
              </button>
            </form>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Tanggal', 'Nama Customer', 'No. PO', 'Sumber', 'Faktur', 'Status', 'Jml Item', 'Aksi'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#94a3b8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f8fafc' }}>
              {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />) :
               data.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                      <ShoppingBag className="h-6 w-6" style={{ color: '#cbd5e1' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Tidak ada data</p>
                  </div>
                </td></tr>
              ) : data.map((row: any) => (
                <tr key={`${row.sumber}-${row.id}`}
                  style={{ background: '#fff' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafbfc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                  <td className="px-5 py-4 text-sm" style={{ color: '#64748b' }}>{formatDate(row.tanggal)}</td>
                  <td className="px-5 py-4"><span className="text-sm font-semibold" style={{ color: '#1e293b' }}>{row.nama_customer}</span></td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#64748b' }}>{row.no_po || '-'}</td>
                  <td className="px-5 py-4"><SumberBadge sumber={row.sumber} /></td>
                  <td className="px-5 py-4"><FakturBadge faktur={row.faktur} /></td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4 text-sm text-center" style={{ color: '#64748b' }}>{row.jumlah_item}</td>
                  <td className="px-5 py-4">
                    <Link href={detailHref(row)}>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = '#fff1f2';
                          (e.currentTarget as HTMLElement).style.color = '#f43f5e';
                          (e.currentTarget as HTMLElement).style.border = '1px solid #fecdd3';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                          (e.currentTarget as HTMLElement).style.color = '#475569';
                          (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                        }}>
                        Detail
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            Halaman <span className="font-semibold" style={{ color: '#475569' }}>{page}</span> dari{' '}
            <span className="font-semibold" style={{ color: '#475569' }}>{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              ← Sebelumnya
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tambah menu "Semua Penjualan" di Sidebar**

Di `frontend/src/components/layout/Sidebar.tsx`, temukan array `children` dalam item `Penjualan` dan tambah entry pertama:

```tsx
children: [
  { label: 'Semua Penjualan', href: '/dashboard/penjualan' },
  { label: 'Penjualan Offline', href: '/dashboard/penjualan/offline' },
  { label: 'Display', href: '/dashboard/display' },
  { label: 'Penjualan Interior', href: '/dashboard/penjualan/interior' },
],
```

- [ ] **Step 3: Verifikasi di browser**

Buka `http://localhost:3000/dashboard/penjualan`. Pastikan:
- Data campuran offline + interior muncul dengan badge Sumber
- Filter sumber, status, faktur berfungsi
- Date range filter berfungsi
- Search berfungsi
- Tombol Detail navigate ke halaman yang benar
- Menu "Semua Penjualan" muncul di sidebar

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/penjualan/page.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: halaman unified sales list dengan filter lengkap"
```
