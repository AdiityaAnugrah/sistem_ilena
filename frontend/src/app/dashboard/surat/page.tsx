'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, InputAdornment, MenuItem, Select,
  FormControl, CircularProgress, Pagination, Chip, IconButton, Button,
} from '@mui/material';
import { Search, FileText, RefreshCw, ArrowUpRight, Building2, Globe2, Store } from 'lucide-react';

const TIPE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  'Surat Jalan': { label: 'Surat Jalan', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Invoice': { label: 'Invoice', bg: '#ecfdf5', color: '#059669', border: '#bbf7d0' },
  'Surat Pengantar': { label: 'Surat Pengantar', bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  'Sub Surat Pengantar': { label: 'Sub SP', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  'Proforma': { label: 'Proforma', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  'Sub Invoice': { label: 'Sub Invoice', bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
};

const SUMBER_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; icon: any }> = {
  OFFLINE: { label: 'Offline', bg: '#fff1f1', color: '#dc2626', border: '#fecaca', icon: Store },
  INTERIOR: { label: 'Interior', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', icon: Building2 },
  ONLINE: { label: 'Online', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: Globe2 },
};

interface SuratRow {
  nomor: string;
  tipe: string;
  sumber: 'OFFLINE' | 'INTERIOR' | 'ONLINE';
  nama_penerima: string;
  tanggal: string;
  penjualan_id: number;
}

function tipeStyle(tipe: string) {
  const c = TIPE_CONFIG[tipe] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: tipe };
  return {
    label: c.label,
    sx: {
      height: 26,
      borderRadius: '999px',
      fontWeight: 900,
      fontSize: '10.5px',
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      '& .MuiChip-label': { px: 1.2 },
    },
  };
}

function sumberStyle(sumber: string) {
  const c = SUMBER_CONFIG[sumber] || { label: sumber, bg: '#f8fafc', color: '#475569', border: '#e2e8f0', icon: FileText };
  return {
    ...c,
    sx: {
      height: 26,
      borderRadius: '999px',
      fontWeight: 900,
      fontSize: '10.5px',
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      '& .MuiChip-label': { px: 1.2 },
    },
  };
}

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<SuratRow[]>([]);
  const [search, setSearch] = useState('');
  const [tipeFilter, setTipeFilter] = useState('');
  const [sumberFilter, setSumberFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (s = search, p = page, t = tipeFilter, sumber = sumberFilter) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (s) params.search = s;
      if (t) params.tipe = t;
      if (sumber) params.sumber = sumber;
      const res = await api.get('/public/surat', { params });
      const rows = res.data.data as SuratRow[];
      setData(rows);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(search, page, tipeFilter, sumberFilter); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData(search, 1, tipeFilter, sumberFilter);
  };

  const reset = () => {
    setSearch(''); setTipeFilter(''); setSumberFilter(''); setPage(1);
    fetchData('', 1, '', '');
  };

  const goToDetail = (row: SuratRow) => {
    if (row.sumber === 'OFFLINE') router.push(`/dashboard/penjualan/offline/${row.penjualan_id}`);
    else if (row.sumber === 'INTERIOR') router.push(`/dashboard/penjualan/interior/${row.penjualan_id}`);
    else router.push(`/dashboard/penjualan/online/${row.penjualan_id}`);
  };

  return (
    <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box
        sx={{
          mb: { xs: 2.5, md: 3 },
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: { xs: '22px', md: '28px' },
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #7f1d1d 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 22px 48px rgba(15,23,42,.14)',
        }}
      >
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.7 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '17px',
              background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FileText size={23} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 950, color: '#fff', fontSize: { xs: 26, md: 32 }, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                Semua Dokumen
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#cbd5e1', mt: 0.7 }}>
                Arsip surat Offline, Interior, dan Online dalam satu halaman.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip label={`${total} Dokumen`} sx={{ height: 34, borderRadius: '999px', fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)' }} />
            <Chip label="Offline + Interior + Online" sx={{ height: 34, borderRadius: '999px', fontWeight: 900, color: '#fecaca', background: 'rgba(250,47,47,.12)', border: '1px solid rgba(254,202,202,.18)' }} />
          </Box>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: { xs: '20px', md: '24px' }, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 14px 38px rgba(15,23,42,.05)' }}>
        {/* Filter Bar */}
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSearch}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }}>Cari Nomor / Nama</Typography>
                <TextField
                  fullWidth size="small" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Contoh: 0006/SJ, INV, nama customer..."
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, sx: { borderRadius: '14px', bgcolor: '#fff', minHeight: 42 } } }}
                />
              </Box>
              <Box sx={{ minWidth: 160 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }}>Tipe Dokumen</Typography>
                <FormControl fullWidth size="small">
                  <Select value={tipeFilter} displayEmpty onChange={e => { setTipeFilter(e.target.value); setPage(1); fetchData(search, 1, e.target.value, sumberFilter); }} sx={{ borderRadius: '14px', bgcolor: '#fff', minHeight: 42 }}>
                    <MenuItem value="">Semua Tipe</MenuItem>
                    <MenuItem value="Surat Jalan">Surat Jalan</MenuItem>
                    <MenuItem value="Invoice">Invoice</MenuItem>
                    <MenuItem value="Surat Pengantar">Surat Pengantar</MenuItem>
                    <MenuItem value="Sub Surat Pengantar">Sub Surat Pengantar</MenuItem>
                    <MenuItem value="Proforma">Proforma</MenuItem>
                    <MenuItem value="Sub Invoice">Sub Invoice</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sumber</Typography>
                <FormControl fullWidth size="small">
                  <Select value={sumberFilter} displayEmpty onChange={e => { setSumberFilter(e.target.value); setPage(1); fetchData(search, 1, tipeFilter, e.target.value); }} sx={{ borderRadius: '14px', bgcolor: '#fff', minHeight: 42 }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="OFFLINE">Offline</MenuItem>
                    <MenuItem value="INTERIOR">Interior</MenuItem>
                    <MenuItem value="ONLINE">Online</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', minHeight: 42 }}>
                <Button type="submit" variant="contained" startIcon={<Search size={15} />} sx={{ minHeight: 42, borderRadius: '14px', px: 2.2, bgcolor: '#FA2F2F', fontWeight: 900, boxShadow: '0 10px 20px rgba(250,47,47,.16)', '&:hover': { bgcolor: '#d41a1a' } }}>
                  Cari
                </Button>
                <IconButton onClick={reset} sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: '14px', height: 42, width: 42 }}>
                  <RefreshCw size={17} />
                </IconButton>
              </Box>
            </Box>
          </form>
        </Box>

        {/* Mobile cards */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2, bgcolor: '#f8fafc' }}>
          {loading ? (
            <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={30} /></Box>
          ) : data.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 16, fontWeight: 600 }}>Tidak ada dokumen ditemukan.</Box>
          ) : (
            <div className="mobile-card-list">
              {data.map((row, idx) => {
                const source = sumberStyle(row.sumber);
                const SourceIcon = source.icon;
                const tipe = tipeStyle(row.tipe);
                return (
                  <button
                    type="button"
                    key={`${row.sumber}-${row.nomor}-${idx}`}
                    className="mobile-record-card text-left"
                    onClick={() => goToDetail(row)}
                    style={{ borderRadius: 18, boxShadow: '0 10px 24px rgba(15,23,42,.05)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mobile-record-title font-mono">{row.nomor}</div>
                        <div className="mobile-record-meta mt-1">{row.nama_penerima}</div>
                        <div className="mobile-record-meta">Tanggal: {formatDate(row.tanggal)}</div>
                      </div>
                      <Chip
                        icon={<SourceIcon size={13} />}
                        label={source.label}
                        size="small"
                        sx={{ ...source.sx, flexShrink: 0 }}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Chip label={tipe.label} size="small" sx={tipe.sx} />
                      <span className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700">
                        Buka Detail <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Box>

        {/* Desktop table */}
        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                {['Nomor Dokumen', 'Tipe', 'Sumber', 'Nama Penerima', 'Tanggal'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '.06em', borderBottom: '1px solid #e2e8f0' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}>Tidak ada dokumen ditemukan.</TableCell></TableRow>
              ) : data.map((row, idx) => {
                const source = sumberStyle(row.sumber);
                const SourceIcon = source.icon;
                const tipe = tipeStyle(row.tipe);
                return (
                  <TableRow
                    key={idx}
                    hover
                    onClick={() => goToDetail(row)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'background .15s ease',
                      '& td': { py: 1.7, borderBottom: '1px solid #f1f5f9' },
                      '&:hover': { bgcolor: '#fffafa' },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Box sx={{ width: 34, height: 34, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={15} color="#475569" />
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 900, color: '#0f172a' }}>
                            {row.nomor}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.2 }}>
                            Klik untuk buka transaksi
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={tipe.label} size="small" sx={tipe.sx} /></TableCell>
                    <TableCell>
                      <Chip icon={<SourceIcon size={13} />} label={source.label} size="small" sx={source.sx} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'capitalize', color: '#1e293b' }}>{row.nama_penerima}</Typography>
                      {row.sumber === 'ONLINE' && (
                        <Typography sx={{ fontSize: 11, color: '#7c3aed', fontWeight: 800, mt: 0.2 }}>Pesanan website / online</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>{formatDate(row.tanggal)}</Typography>
                        <ArrowUpRight size={15} color="#94a3b8" />
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Typography variant="caption" sx={{ fontSize: { xs: 13, md: 12 }, fontWeight: 900, color: '#64748b' }}>Total {total} dokumen</Typography>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '10px', fontWeight: 800 } }} />
        </Box>
      </Paper>
    </Box>
  );
}
