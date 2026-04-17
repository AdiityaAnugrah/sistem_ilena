# Semua Surat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman publik `/surat` yang menampilkan list semua invoice (Offline + Interior), bisa diklik untuk melihat tree dokumen terkait, tanpa login — tapi aksi TTD/download tetap butuh login.

**Architecture:** Backend: 2 endpoint publik baru di `/api/public/surat`. Frontend: 2 halaman di luar `/dashboard` dengan layout sendiri, plus link di sidebar dashboard.

**Tech Stack:** Next.js App Router, Express.js, Sequelize, MUI v6

---

## File Structure

**Backend (baru):**
- `backend/src/routes/publicSurat.js` — 2 endpoint publik tanpa `authenticate`

**Backend (modifikasi):**
- `backend/src/app.js` — daftarkan route `/api/public/surat`

**Frontend (baru):**
- `frontend/src/app/surat/layout.tsx` — layout publik (tanpa AuthGuard, dengan header minimal)
- `frontend/src/app/surat/page.tsx` — list semua invoice
- `frontend/src/app/surat/[sumber]/[id]/page.tsx` — tree dokumen per penjualan

**Frontend (modifikasi):**
- `frontend/src/components/layout/Sidebar.tsx` — tambah link "Semua Surat" ke `/surat`

---

## Task 1: Backend — Route Publik List Invoice

**Files:**
- Create: `backend/src/routes/publicSurat.js`

- [ ] **Step 1: Buat file route**

```js
const express = require('express');
const { Op } = require('sequelize');
const { Invoice, InvoiceInterior, PenjualanOffline, PenjualanInterior } = require('../models');

const router = express.Router();

// GET /api/public/surat
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereInv = { '$penjualan.is_test$': 0 };
    const whereInvInt = { '$penjualan.is_test$': 0 };

    if (search) {
      whereInv[Op.or] = [{ nomor_invoice: { [Op.like]: `%${search}%` } }];
      whereInvInt[Op.or] = [{ nomor_invoice: { [Op.like]: `%${search}%` } }];
    }

    const [offlineRows, interiorRows] = await Promise.all([
      Invoice.findAll({
        where: whereInv,
        include: [{ model: PenjualanOffline, as: 'penjualan', attributes: ['id', 'nama_penerima', 'is_test'] }],
        order: [['tanggal', 'DESC']],
      }),
      InvoiceInterior.findAll({
        where: whereInvInt,
        include: [{ model: PenjualanInterior, as: 'penjualan', attributes: ['id', 'nama_customer', 'is_test'] }],
        order: [['tanggal', 'DESC']],
      }),
    ]);

    const combined = [
      ...offlineRows.map(r => ({
        id: r.id,
        penjualan_id: r.penjualan_offline_id,
        nomor: r.nomor_invoice,
        tanggal: r.tanggal,
        jatuh_tempo: r.jatuh_tempo,
        nama_penerima: r.penjualan?.nama_penerima || '-',
        sumber: 'OFFLINE',
      })),
      ...interiorRows.map(r => ({
        id: r.id,
        penjualan_id: r.penjualan_interior_id,
        nomor: r.nomor_invoice,
        tanggal: r.tanggal,
        jatuh_tempo: r.jatuh_tempo,
        nama_penerima: r.penjualan?.nama_customer || '-',
        sumber: 'INTERIOR',
      })),
    ]
      .filter(r => {
        if (!search) return true;
        return r.nomor?.toLowerCase().includes(search.toLowerCase()) ||
               r.nama_penerima?.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const total = combined.length;
    const data = combined.slice(offset, offset + parseInt(limit));

    return res.json({ data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});
```

- [ ] **Step 2: Tambah endpoint tree dokumen ke file yang sama**

```js
// GET /api/public/surat/:sumber/:penjualanId
router.get('/:sumber/:penjualanId', async (req, res) => {
  try {
    const { sumber, penjualanId } = req.params;

    if (sumber === 'OFFLINE') {
      const {
        SuratJalan, Invoice: Inv, SuratPengantar, SuratPengantarSub,
      } = require('../models');

      const penjualan = await PenjualanOffline.findByPk(penjualanId, {
        attributes: ['id', 'nama_penerima', 'tipe', 'faktur', 'tanggal', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [invoices, suratJalans, suratPengantars] = await Promise.all([
        Inv.findAll({ where: { penjualan_offline_id: penjualanId }, attributes: ['id', 'nomor_invoice', 'tanggal'] }),
        SuratJalan.findAll({ where: { penjualan_offline_id: penjualanId }, attributes: ['id', 'nomor_surat', 'tanggal'] }),
        SuratPengantar.findAll({ where: { penjualan_offline_id: penjualanId }, attributes: ['id', 'nomor_sp', 'tanggal'],
          include: [{ model: SuratPengantarSub, as: 'subs', attributes: ['id', 'nomor_sp_sub'] }] }),
      ]);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'OFFLINE',
        dokumen: {
          invoices: invoices.map(d => ({ id: d.id, nomor: d.nomor_invoice, tanggal: d.tanggal, tipe: 'invoice' })),
          suratJalans: suratJalans.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'surat-jalan' })),
          suratPengantars: suratPengantars.map(d => ({
            id: d.id, nomor: d.nomor_sp, tanggal: d.tanggal, tipe: 'sp',
            subs: (d.subs || []).map(s => ({ id: s.id, nomor: s.nomor_sp_sub, tipe: 'sp-sub' })),
          })),
        },
      });
    }

    if (sumber === 'INTERIOR') {
      const { ProformaInvoice, SuratJalanInterior, InvoiceInterior: InvInt } = require('../models');

      const penjualan = await PenjualanInterior.findByPk(penjualanId, {
        attributes: ['id', 'nama_customer', 'tanggal', 'is_test'],
      });
      if (!penjualan || penjualan.is_test) return res.status(404).json({ message: 'Tidak ditemukan' });

      const [proformas, suratJalans, invoices] = await Promise.all([
        ProformaInvoice.findAll({ where: { penjualan_interior_id: penjualanId }, attributes: ['id', 'nomor_proforma', 'tanggal'] }),
        SuratJalanInterior.findAll({ where: { penjualan_interior_id: penjualanId }, attributes: ['id', 'nomor_surat', 'tanggal'] }),
        InvInt.findAll({ where: { penjualan_interior_id: penjualanId }, attributes: ['id', 'nomor_invoice', 'tanggal'] }),
      ]);

      return res.json({
        penjualan: penjualan.toJSON(),
        sumber: 'INTERIOR',
        dokumen: {
          proformas: proformas.map(d => ({ id: d.id, nomor: d.nomor_proforma, tanggal: d.tanggal, tipe: 'proforma' })),
          suratJalans: suratJalans.map(d => ({ id: d.id, nomor: d.nomor_surat, tanggal: d.tanggal, tipe: 'surat-jalan-interior' })),
          invoices: invoices.map(d => ({ id: d.id, nomor: d.nomor_invoice, tanggal: d.tanggal, tipe: 'invoice-interior' })),
        },
      });
    }

    return res.status(400).json({ message: 'Sumber tidak valid (OFFLINE atau INTERIOR)' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Daftarkan route di `backend/src/app.js`**

Cari baris yang mendaftarkan routes lain (misalnya `app.use('/api/dokumen', ...)`), tambahkan sebelum baris `module.exports`:

```js
const publicSuratRoutes = require('./routes/publicSurat');
app.use('/api/public/surat', publicSuratRoutes);
```

- [ ] **Step 4: Test manual dengan curl**

```bash
curl http://localhost:5000/api/public/surat
```
Expected: `{ data: [...], total: N, ... }` — tanpa token apapun.

```bash
curl http://localhost:5000/api/public/surat/OFFLINE/1
```
Expected: `{ penjualan: {...}, sumber: "OFFLINE", dokumen: { invoices: [...], suratJalans: [...], suratPengantars: [...] } }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/publicSurat.js backend/src/app.js
git commit -m "feat: tambah public API /api/public/surat untuk list & tree dokumen"
```

---

## Task 2: Frontend — Layout Publik `/surat`

**Files:**
- Create: `frontend/src/app/surat/layout.tsx`

Layout ini tidak punya AuthGuard. Hanya header minimal dengan logo dan link login.

- [ ] **Step 1: Buat file layout**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Semua Surat — ILENA',
};

export default function SuratLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <header style={{
        backgroundColor: '#0f172a',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>IL</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 14 }}>ILENA</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>/ Semua Surat</span>
        </div>
        <a
          href="/login"
          style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none', padding: '6px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          Masuk
        </a>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/surat/layout.tsx
git commit -m "feat: tambah layout publik untuk halaman /surat"
```

---

## Task 3: Frontend — Halaman List Invoice `/surat`

**Files:**
- Create: `frontend/src/app/surat/page.tsx`

- [ ] **Step 1: Buat file halaman list**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TextField, InputAdornment, Pagination, Chip, CircularProgress } from '@mui/material';
import { Search, FileText, ArrowRight } from 'lucide-react';

interface SuratItem {
  id: number;
  penjualan_id: number;
  nomor: string;
  tanggal: string;
  jatuh_tempo: string | null;
  nama_penerima: string;
  sumber: 'OFFLINE' | 'INTERIOR';
}

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<SuratItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async (p: number, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', ...(s ? { search: s } : {}) });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/public/surat?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(page, search); }, [page]);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    fetchData(1, v);
  };

  const formatTgl = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Semua Surat</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
          {total} invoice ditemukan — klik untuk melihat dokumen terkait
        </p>
      </div>

      <TextField
        fullWidth
        size="small"
        placeholder="Cari nomor invoice atau nama penerima..."
        value={search}
        onChange={e => handleSearch(e.target.value)}
        sx={{ mb: 3, backgroundColor: '#fff', borderRadius: '10px' }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} color="#94a3b8" /></InputAdornment> } }}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <CircularProgress size={32} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
          Tidak ada invoice ditemukan
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(item => (
            <div
              key={`${item.sumber}-${item.id}`}
              onClick={() => router.push(`/surat/${item.sumber}/${item.penjualan_id}`)}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#FA2F2F';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(250,47,47,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={17} color="#FA2F2F" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', fontFamily: 'monospace' }}>
                  {item.nomor}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {item.nama_penerima} · {formatTgl(item.tanggal)}
                  {item.jatuh_tempo && ` · Jatuh Tempo: ${formatTgl(item.jatuh_tempo)}`}
                </div>
              </div>
              <Chip
                label={item.sumber}
                size="small"
                sx={{
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  backgroundColor: item.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4',
                  color: item.sumber === 'OFFLINE' ? '#3b82f6' : '#16a34a',
                }}
              />
              <ArrowRight size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi tampilan di browser**

Buka `http://localhost:3000/surat` — harus tampil list invoice tanpa perlu login.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/surat/page.tsx
git commit -m "feat: halaman publik /surat — list semua invoice tanpa login"
```

---

## Task 4: Frontend — Halaman Tree Dokumen `/surat/[sumber]/[id]`

**Files:**
- Create: `frontend/src/app/surat/[sumber]/[id]/page.tsx`

- [ ] **Step 1: Buat file halaman tree**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FileText, ArrowLeft, ExternalLink, Lock } from 'lucide-react';

interface DokumenCard {
  id: number;
  nomor: string;
  tanggal?: string;
  tipe: string;
  subs?: { id: number; nomor: string; tipe: string }[];
}

interface TreeData {
  penjualan: { id: number; nama_penerima?: string; nama_customer?: string; tanggal: string; tipe?: string };
  sumber: 'OFFLINE' | 'INTERIOR';
  dokumen: {
    invoices?: DokumenCard[];
    suratJalans?: DokumenCard[];
    suratPengantars?: DokumenCard[];
    proformas?: DokumenCard[];
  };
}

const TIPE_LABEL: Record<string, string> = {
  'invoice': 'Invoice',
  'surat-jalan': 'Surat Jalan',
  'sp': 'Surat Pengantar',
  'sp-sub': 'SP Sub',
  'proforma': 'Proforma Invoice',
  'surat-jalan-interior': 'Surat Jalan Interior',
  'invoice-interior': 'Invoice Interior',
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TreeSuratPage() {
  const { sumber, id } = useParams<{ sumber: string; id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModal, setLoginModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');

  useEffect(() => {
    fetch(`${API}/api/public/surat/${sumber}/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sumber, id]);

  const handleLihat = (tipe: string, docId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const url = `${API}/api/dokumen/${tipe}/${docId}/print?token=${token}`;
    if (!token) {
      setPendingUrl(`${API}/api/dokumen/${tipe}/${docId}/print`);
      setLoginModal(true);
      return;
    }
    window.open(url, '_blank');
  };

  const formatTgl = (d?: string) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

  const DokCard = ({ doc, indent = false }: { doc: DokumenCard; indent?: boolean }) => (
    <div style={{
      backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      marginLeft: indent ? 24 : 0,
      borderLeft: indent ? '3px solid #e2e8f0' : '1px solid #e2e8f0',
    }}>
      <FileText size={15} color="#FA2F2F" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>{doc.nomor}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
          {TIPE_LABEL[doc.tipe] || doc.tipe}{doc.tanggal ? ` · ${formatTgl(doc.tanggal)}` : ''}
        </div>
      </div>
      <button
        onClick={() => handleLihat(doc.tipe, doc.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
          borderRadius: 8, border: '1px solid #FA2F2F', backgroundColor: 'transparent',
          color: '#FA2F2F', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <ExternalLink size={12} />
        Lihat
      </button>
    </div>
  );

  const allDokumen = data ? [
    ...(data.dokumen.invoices || []),
    ...(data.dokumen.suratJalans || []),
    ...(data.dokumen.suratPengantars || []),
    ...(data.dokumen.proformas || []),
  ] : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <CircularProgress />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
        Penjualan tidak ditemukan.
      </div>
    );
  }

  const namaPenerima = data.penjualan.nama_penerima || data.penjualan.nama_customer || '-';

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push('/surat')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', fontSize: 13, padding: 0,
        }}
      >
        <ArrowLeft size={15} />
        Kembali ke Semua Surat
      </button>

      {/* Header info penjualan */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '18px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Penjualan</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginTop: 4 }}>{namaPenerima}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{formatTgl(data.penjualan.tanggal)}</div>
        </div>
        <Chip
          label={data.sumber}
          sx={{
            fontWeight: 700, fontSize: 11,
            backgroundColor: data.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4',
            color: data.sumber === 'OFFLINE' ? '#3b82f6' : '#16a34a',
          }}
        />
      </div>

      {/* Dokumen count */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14, fontWeight: 600 }}>
        {allDokumen.length} dokumen ditemukan
      </div>

      {/* Tree dokumen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.dokumen.invoices?.map(d => <DokCard key={`inv-${d.id}`} doc={d} />)}
        {data.dokumen.proformas?.map(d => <DokCard key={`pro-${d.id}`} doc={d} />)}
        {data.dokumen.suratJalans?.map(d => <DokCard key={`sj-${d.id}`} doc={d} indent />)}
        {data.dokumen.suratPengantars?.map(d => (
          <div key={`sp-${d.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <DokCard doc={d} indent />
            {d.subs?.map(s => <DokCard key={`sub-${s.id}`} doc={s} indent />)}
          </div>
        ))}
      </div>

      {allDokumen.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
          Belum ada dokumen yang dibuat untuk penjualan ini.
        </div>
      )}

      {/* Login modal */}
      <Dialog open={loginModal} onClose={() => setLoginModal(false)} PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
          <Lock size={18} color="#FA2F2F" />
          Login Diperlukan
        </DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            Untuk melihat detail dokumen, menambah tanda tangan, atau mengunduh, Anda perlu login terlebih dahulu.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setLoginModal(false)} color="inherit" sx={{ fontWeight: 600 }}>Tutup</Button>
          <Button
            variant="contained"
            onClick={() => {
              const returnUrl = encodeURIComponent(window.location.pathname);
              router.push(`/login?return=${returnUrl}`);
            }}
            sx={{ borderRadius: '10px', fontWeight: 700, backgroundColor: '#FA2F2F', '&:hover': { backgroundColor: '#d41a1a' } }}
          >
            Login Sekarang
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi di browser**

Buka `http://localhost:3000/surat` → klik salah satu invoice → harus tampil tree dokumen.
Klik tombol "Lihat" tanpa login → harus muncul modal login.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/surat/[sumber]/[id]/page.tsx
git commit -m "feat: halaman tree dokumen /surat/[sumber]/[id] — publik dengan login gate"
```

---

## Task 5: Frontend — Tambah Link "Semua Surat" di Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Tambah import icon `Folder` dari lucide-react**

Di baris import lucide-react, tambahkan `Folder`:
```tsx
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  ChevronDown,
  LogOut,
  Users,
  Folder,
} from 'lucide-react';
```

- [ ] **Step 2: Tambah item ke `NAV_ITEMS` setelah Master Barang**

```tsx
{ label: 'Semua Surat', href: '/surat', icon: Folder },
```

Array NAV_ITEMS yang diubah:
```tsx
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Penjualan',
    icon: ShoppingCart,
    children: [
      { label: 'Semua Penjualan', href: '/dashboard/penjualan' },
      { label: 'Penjualan Offline', href: '/dashboard/penjualan/offline' },
      { label: 'Display', href: '/dashboard/display' },
      { label: 'Penjualan Interior', href: '/dashboard/penjualan/interior' },
    ],
  },
  { label: 'Master Barang', href: '/dashboard/master/barang', icon: Package },
  { label: 'Semua Surat', href: '/surat', icon: Folder },
  { label: 'Pengguna', href: '/dashboard/pengguna', icon: Users, devOrSuperAdminOnly: true },
  { label: 'Log Aktivitas', href: '/dashboard/log-activity', icon: ClipboardList, devOnly: true },
];
```

- [ ] **Step 3: Verifikasi di browser**

Buka dashboard → cek sidebar ada "Semua Surat" → klik → buka `/surat`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: tambah link Semua Surat di sidebar navigasi"
```

---

## Task 6: Deploy & Final Check

- [ ] **Step 1: Push ke remote**

```bash
git push
```

- [ ] **Step 2: Deploy di server**

```bash
git pull && cd backend && npm install && pm2 restart all
cd ../frontend && npm run build && pm2 restart frontend
```

- [ ] **Step 3: Cek endpoint publik di server**

```bash
curl https://your-domain/api/public/surat
```

- [ ] **Step 4: Cek halaman publik tanpa login**

Buka `/surat` di incognito/tanpa login → harus tampil list invoice.
Klik invoice → tampil tree.
Klik "Lihat" → tampil modal login.

- [ ] **Step 5: Cek halaman saat login**

Login → buka `/surat` → klik "Lihat" → buka halaman print di tab baru.
