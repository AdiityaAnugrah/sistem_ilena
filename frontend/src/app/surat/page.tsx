'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TextField, InputAdornment, Pagination, Chip, CircularProgress, Select, MenuItem,
} from '@mui/material';
import { Search, FileText, ArrowRight } from 'lucide-react';

interface SuratItem {
  nomor: string;
  tipe: string;
  tanggal: string;
  nama_penerima: string;
  sumber: 'OFFLINE' | 'INTERIOR';
  penjualan_id: number;
}

const TIPE_STYLE: Record<string, { bg: string; color: string }> = {
  'Surat Jalan':     { bg: '#eff6ff', color: '#3b82f6' },
  'Invoice':         { bg: '#f0fdf4', color: '#16a34a' },
  'Surat Pengantar': { bg: '#fffbeb', color: '#d97706' },
  'Proforma':        { bg: '#f5f3ff', color: '#7c3aed' },
};

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<SuratItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipeFilter, setTipeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: number, s: string, t: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', ...(s ? { search: s } : {}), ...(t ? { tipe: t } : {}) });
      const res = await fetch(`${API}/api/public/surat?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(page, search, tipeFilter); }, [page, fetchData]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); fetchData(1, v, tipeFilter); };
  const handleTipe = (v: string) => { setTipeFilter(v); setPage(1); fetchData(1, search, v); };

  const formatTgl = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <style>{`
        .surat-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .surat-card:hover { border-color: #FA2F2F; box-shadow: 0 2px 12px rgba(250,47,47,0.1); }
        .surat-card-nomor {
          font-weight: 700; font-size: 12px; color: #0f172a;
          font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .surat-card-sub { font-size: 10px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .surat-filter-bar { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .surat-chips { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
        .surat-arrow { display: none; }
        .surat-icon { width: 30px; height: 30px; border-radius: 7px; background: #fef2f2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        @media (min-width: 480px) {
          .surat-filter-bar { flex-direction: row; }
          .surat-card { padding: 13px 16px; gap: 12px; }
          .surat-card-nomor { font-size: 13px; }
          .surat-card-sub { font-size: 11px; }
          .surat-arrow { display: block; }
          .surat-icon { width: 34px; height: 34px; border-radius: 8px; }
        }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Semua Dokumen</h1>
        <p style={{ color: '#64748b', fontSize: 12, margin: '3px 0 0' }}>{total} dokumen ditemukan</p>
      </div>

      <div className="surat-filter-bar">
        <TextField
          size="small" fullWidth
          placeholder="Cari nomor / nama penerima..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          sx={{ backgroundColor: '#fff', borderRadius: '10px', '& .MuiInputBase-input': { fontSize: 13 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} color="#94a3b8" /></InputAdornment> } }}
        />
        <Select
          size="small" value={tipeFilter} displayEmpty
          onChange={e => handleTipe(e.target.value)}
          sx={{ minWidth: 150, backgroundColor: '#fff', borderRadius: '10px', fontSize: 13 }}
        >
          <MenuItem value="" sx={{ fontSize: 13 }}>Semua Tipe</MenuItem>
          <MenuItem value="Surat Jalan" sx={{ fontSize: 13 }}>Surat Jalan</MenuItem>
          <MenuItem value="Invoice" sx={{ fontSize: 13 }}>Invoice</MenuItem>
          <MenuItem value="Surat Pengantar" sx={{ fontSize: 13 }}>Surat Pengantar</MenuItem>
          <MenuItem value="Proforma" sx={{ fontSize: 13 }}>Proforma</MenuItem>
        </Select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CircularProgress size={28} sx={{ color: '#FA2F2F' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
          Tidak ada dokumen ditemukan
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {data.map(item => {
            const tipeStyle = TIPE_STYLE[item.tipe] || { bg: '#f8fafc', color: '#64748b' };
            return (
              <div
                key={`${item.sumber}-${item.nomor}`}
                className="surat-card"
                onClick={() => router.push(`/surat/${item.sumber}/${item.penjualan_id}`)}
              >
                <div className="surat-icon">
                  <FileText size={14} color="#FA2F2F" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="surat-card-nomor">{item.nomor}</div>
                  <div className="surat-card-sub">{item.nama_penerima} · {formatTgl(item.tanggal)}</div>
                </div>

                <div className="surat-chips">
                  <Chip label={item.tipe} size="small" sx={{ fontSize: 9, fontWeight: 700, height: 18, backgroundColor: tipeStyle.bg, color: tipeStyle.color }} />
                  <Chip label={item.sumber} size="small" sx={{ fontSize: 9, fontWeight: 700, height: 18, backgroundColor: item.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4', color: item.sumber === 'OFFLINE' ? '#3b82f6' : '#16a34a' }} />
                </div>

                <div className="surat-arrow">
                  <ArrowRight size={14} color="#cbd5e1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
        </div>
      )}
    </div>
  );
}
