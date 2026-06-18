'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, TextField, InputAdornment,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Pagination, Button,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Search, Eye, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useListSync } from '@/hooks/useListSync';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
  DRAFT:     { label: 'Draft',   color: 'default' },
  ACTIVE:    { label: 'Aktif',   color: 'info' },
  COMPLETED: { label: 'Selesai', color: 'success' },
};

interface OfflineDoc {
  nomor_surat?: string;
  nomor_invoice?: string;
}

interface OfflineRow {
  id: number;
  tanggal: string;
  nama_penerima: string;
  faktur: string;
  status: string;
  tipe: string;
  suratJalans?: OfflineDoc[];
  invoices?: OfflineDoc[];
}

type PenjualanSummary = {
  totalNilai: number;
};

const emptySummary: PenjualanSummary = { totalNilai: 0 };

export default function PenjualanOfflinePage() {
  const [data, setData] = useState<OfflineRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PenjualanSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [tipeFilter, setTipeFilter] = useState('PENJUALAN');
  const [statusFilter, setStatusFilter] = useState('');
  const [fakturFilter, setFakturFilter] = useState('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');

  const fetchData = async (
    s = search, p = page, tipe = tipeFilter,
    status = statusFilter, faktur = fakturFilter,
    dari = tanggalDari, sampai = tanggalSampai,
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20, tipe };
      if (s)      params.search         = s;
      if (status) params.status         = status;
      if (faktur) params.faktur         = faktur;
      if (dari)   params.tanggal_dari   = dari;
      if (sampai) params.tanggal_sampai = sampai;
      const res = await api.get('/penjualan-offline', { params });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setSummary(res.data.summary || emptySummary);
    } catch {
      setSummary(emptySummary);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, tipeFilter, statusFilter, fakturFilter, tanggalDari, tanggalSampai]);
  useListSync('penjualan-offline-list', () => fetchData());

  const resetFilters = () => {
    setSearch(''); setTipeFilter('PENJUALAN'); setStatusFilter('');
    setFakturFilter(''); setTanggalDari(''); setTanggalSampai('');
    setPage(1);
  };

  return (
    <Box sx={{ p: { xs: 0, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: { xs: 2, md: 4 }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <ShoppingBag size={28} style={{ color: '#FA2F2F', flexShrink: 0 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', fontSize: { xs: 26, md: 34 }, lineHeight: 1.15 }}>Penjualan Offline</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 15, md: 14 } }}>Total {total} transaksi tercatat</Typography>
        </Box>
        <Link href="/dashboard/penjualan/offline/baru" style={{ textDecoration: 'none' }}>
          <Button fullWidth variant="contained" startIcon={<Plus size={18} />} sx={{ borderRadius: '12px', px: 3, py: { xs: 1.35, md: 1.2 }, minHeight: { xs: 48, md: 40 }, fontSize: { xs: 15, md: 14 }, boxShadow: '0 4px 12px rgba(250,47,47,0.25)', bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>
            Penjualan Baru
          </Button>
        </Link>
      </Box>

      <Paper sx={{ borderRadius: { xs: '16px', md: '20px' }, overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'rgba(248,250,252,0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData(search, 1); }}>
            <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Nama / No. HP</Typography>
                <TextField fullWidth size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..."
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Dari</Typography>
                <DateInput value={tanggalDari} onChange={e => setTanggalDari(e.target.value)} style={{ width: '100%', padding: '7px 12px', borderRadius: '10px', background: '#fff', border: '1px solid #e0e0e0', fontSize: 14 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Ke</Typography>
                <DateInput value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)} style={{ width: '100%', padding: '7px 12px', borderRadius: '10px', background: '#fff', border: '1px solid #e0e0e0', fontSize: 14 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipe</InputLabel>
                  <Select value={tipeFilter} label="Tipe" onChange={e => { setTipeFilter(e.target.value); setPage(1); }} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="PENJUALAN">Penjualan</MenuItem>
                    <MenuItem value="DISPLAY">Display</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={statusFilter} label="Status" onChange={e => { setStatusFilter(e.target.value); setPage(1); }} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="ACTIVE">Aktif</MenuItem>
                    <MenuItem value="COMPLETED">Selesai</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Faktur</InputLabel>
                  <Select value={fakturFilter} label="Faktur" onChange={e => { setFakturFilter(e.target.value); setPage(1); }} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="FAKTUR">Faktur</MenuItem>
                    <MenuItem value="NON_FAKTUR">Non Faktur</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" type="submit" sx={{ borderRadius: '10px', flex: 1, bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>Cari</Button>
                  <IconButton onClick={resetFilters} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}><RefreshCw size={18} /></IconButton>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>

        {/* Mobile cards */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2, bgcolor: '#f8fafc' }}>
          {loading ? (
            <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={30} /></Box>
          ) : data.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 16, fontWeight: 600 }}>Tidak ada data.</Box>
          ) : (
            <div className="mobile-card-list">
              {data.map((row) => (
                <article key={row.id} className="mobile-record-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mobile-record-title">{row.nama_penerima}</div>
                      <div className="mobile-record-meta mt-1">Tanggal: {formatDate(row.tanggal)}</div>
                      <div className="mobile-record-meta">No. SJ: {row.suratJalans?.map((sj) => sj.nomor_surat).join(', ') || '-'}</div>
                      <div className="mobile-record-meta">No. INV: {row.invoices?.map((inv) => inv.nomor_invoice).join(', ') || '-'}</div>
                    </div>
                    <Chip label={STATUS_CONFIG[row.status]?.label || row.status} size="small" color={STATUS_CONFIG[row.status]?.color || 'default'} sx={{ fontWeight: 800, borderRadius: '8px', flexShrink: 0 }} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Faktur'} size="small" variant="outlined" sx={{ fontWeight: 800, borderRadius: '8px' }} />
                    <Chip label={row.tipe === 'DISPLAY' ? 'Display' : 'Penjualan'} size="small" variant="outlined" color="primary" sx={{ fontWeight: 800, borderRadius: '8px' }} />
                  </div>
                  <Link href={`/dashboard/penjualan/offline/${row.id}`} style={{ textDecoration: 'none' }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Eye size={18} />}
                      className="mobile-action-button"
                      sx={{ mt: 2, bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}
                    >
                      Buka Detail
                    </Button>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </Box>

        {/* Desktop table */}
        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
              <TableRow>
                {['Tanggal', 'Nama Penerima', 'No. SJ', 'No. INV', 'Status Pajak', 'Status', 'Aksi'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 10 }}>Tidak ada data.</TableCell></TableRow>
              ) : data.map((row) => (
                <TableRow key={row.id} hover sx={{ '& td': { py: 1.8 } }}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.tanggal)}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.nama_penerima}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: row.suratJalans?.length ? 'text.primary' : 'text.disabled' }}>
                      {row.suratJalans?.map((sj) => sj.nomor_surat).join(', ') || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: row.invoices?.length ? 'text.primary' : 'text.disabled' }}>
                      {row.invoices?.map((inv) => inv.nomor_invoice).join(', ') || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Faktur'} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={STATUS_CONFIG[row.status]?.label || row.status} size="small" color={STATUS_CONFIG[row.status]?.color || 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/penjualan/offline/${row.id}`} style={{ textDecoration: 'none' }}>
                      <Button size="small" variant="outlined" startIcon={<Eye size={14} />} sx={{ borderRadius: '8px', fontWeight: 700 }}>Detail</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, bgcolor: 'rgba(248,250,252,0.5)' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 13, md: 12 }, fontWeight: 700 }}>Total {total} transaksi</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 13, md: 12 }, fontWeight: 700 }}>Total harga keseluruhan: <strong>{formatRupiah(summary.totalNilai)}</strong></Typography>
          </Box>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }} />
        </Box>
      </Paper>
    </Box>
  );
}
