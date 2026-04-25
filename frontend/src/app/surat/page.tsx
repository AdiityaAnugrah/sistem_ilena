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

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    fetchData(1, v, tipeFilter);
  };

  const handleTipe = (v: string) => {
    setTipeFilter(v);
    setPage(1);
    fetchData(1, search, v);
  };

  const formatTgl = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <style>{`
        .surat-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .surat-card:hover {
          border-color: #FA2F2F;
          box-shadow: 0 2px 12px rgba(250,47,47,0.1);
        }
        .surat-card-nomor {
          font-weight: 700;
          font-size: 13px;
          color: #0f172a;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 480px) {
          .surat-card { padding: 14px 18px; gap: 14px; }
          .surat-card-nomor { font-size: 14px; }
        }
        .surat-chip-hide { display: none; }
        @media (min-width: 360px) { .surat-chip-hide { display: flex; } }
        .surat-arrow-hide { display: none; }
        @media (min-width: 480px) { .surat-arrow-hide { display: block; } }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Semua Dokumen</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
          {total} dokumen ditemukan
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Cari nomor dokumen atau nama penerima..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: '10px' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#94a3b8" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Select
          size="small"
          value={tipeFilter}
          displayEmpty
          onChange={e => handleTipe(e.target.value)}
          sx={{ minWidth: 160, backgroundColor: '#fff', borderRadius: '10px', fontSize: 13 }}
        >
          <MenuItem value="">Semua Tipe</MenuItem>
          <MenuItem value="Surat Jalan">Surat Jalan</MenuItem>
          <MenuItem value="Invoice">Invoice</MenuItem>
          <MenuItem value="Surat Pengantar">Surat Pengantar</MenuItem>
          <MenuItem value="Proforma">Proforma</MenuItem>
        </Select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <CircularProgress size={32} sx={{ color: '#FA2F2F' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
          Tidak ada dokumen ditemukan
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(item => {
            const tipeStyle = TIPE_STYLE[item.tipe] || { bg: '#f8fafc', color: '#64748b' };
            return (
              <div
                key={`${item.sumber}-${item.nomor}`}
                className="surat-card"
                onClick={() => router.push(`/surat/${item.sumber}/${item.penjualan_id}`)}
              >
                {/* Icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  backgroundColor: '#fef2f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <FileText size={16} color="#FA2F2F" />
                </div>

                {/* Teks */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="surat-card-nomor">{item.nomor}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.nama_penerima} · {formatTgl(item.tanggal)}
                  </div>
                </div>

                {/* Chips */}
                <div className="surat-chip-hide" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Chip
                    label={item.tipe}
                    size="small"
                    sx={{ fontSize: 10, fontWeight: 700, backgroundColor: tipeStyle.bg, color: tipeStyle.color }}
                  />
                  <Chip
                    label={item.sumber}
                    size="small"
                    sx={{
                      fontSize: 10, fontWeight: 700,
                      backgroundColor: item.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4',
                      color: item.sumber === 'OFFLINE' ? '#3b82f6' : '#16a34a',
                    }}
                  />
                </div>

                {/* Arrow */}
                <div className="surat-arrow-hide">
                  <ArrowRight size={15} color="#cbd5e1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            size="small"
          />
        </div>
      )}
    </div>
  );
}
