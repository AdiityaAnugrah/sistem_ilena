'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TextField, InputAdornment, Pagination, Chip, CircularProgress,
} from '@mui/material';
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

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<SuratItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', ...(s ? { search: s } : {}) });
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

  useEffect(() => { fetchData(page, search); }, [page, fetchData]);

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
          {total} invoice ditemukan  
        </p>
      </div>

      <TextField
        fullWidth
        size="small"
        placeholder="Cari nomor invoice atau nama penerima..."
        value={search}
        onChange={e => handleSearch(e.target.value)}
        sx={{ mb: 3, backgroundColor: '#fff', borderRadius: '10px' }}
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
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
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FileText size={17} color="#FA2F2F" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', fontFamily: 'monospace' }}>
                  {item.nomor}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {item.nama_penerima} · {formatTgl(item.tanggal)}
                  {item.jatuh_tempo ? ` · Jatuh Tempo: ${formatTgl(item.jatuh_tempo)}` : ''}
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
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </div>
      )}
    </div>
  );
}
