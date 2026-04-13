'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, TextField, InputAdornment,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Pagination, Button,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Search, Eye, Plus, RefreshCw, Home } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
  DRAFT:     { label: 'Draft',   color: 'default' },
  ACTIVE:    { label: 'Aktif',   color: 'info' },
  COMPLETED: { label: 'Selesai', color: 'success' },
};

export default function PenjualanInteriorPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');

  const fetchData = async (
    s = search, p = page,
    status = statusFilter, dari = tanggalDari, sampai = tanggalSampai,
  ) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: p, limit: 20 };
      if (s)      params.search         = s;
      if (status) params.status         = status;
      if (dari)   params.tanggal_dari   = dari;
      if (sampai) params.tanggal_sampai = sampai;
      const res = await api.get('/penjualan-interior', { params });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter, tanggalDari, tanggalSampai]);

  const resetFilters = () => {
    setSearch(''); setStatusFilter(''); setTanggalDari(''); setTanggalSampai('');
    setPage(1);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Home size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Penjualan Interior</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Total {total} proyek interior tercatat</Typography>
        </Box>
        <Link href="/dashboard/penjualan/interior/baru" style={{ textDecoration: 'none' }}>
          <Button variant="contained" startIcon={<Plus size={18} />} sx={{ borderRadius: '12px', px: 3, py: 1.2, boxShadow: '0 4px 12px rgba(250,47,47,0.25)', bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>
            Interior Baru
          </Button>
        </Link>
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 3, bgcolor: 'rgba(248,250,252,0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData(search, 1); }}>
            <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Customer / No. PO</Typography>
                <TextField fullWidth size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..."
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Dari</Typography>
                <TextField type="date" fullWidth size="small" value={tanggalDari} onChange={e => setTanggalDari(e.target.value)} slotProps={{ input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Ke</Typography>
                <TextField type="date" fullWidth size="small" value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)} slotProps={{ input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
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
              <Grid size={{ xs: 6, md: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" type="submit" sx={{ borderRadius: '10px', flex: 1, bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>Cari</Button>
                  <IconButton onClick={resetFilters} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}><RefreshCw size={18} /></IconButton>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
              <TableRow>
                {['Tanggal', 'No. PO', 'Nama Customer', 'No. HP', 'Faktur', 'Status', 'Aksi'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 10 }}>Tidak ada data.</TableCell></TableRow>
              ) : data.map((row: any) => (
                <TableRow key={row.id} hover sx={{ '& td': { py: 1.8 } }}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.tanggal)}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>{row.no_po || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.nama_customer}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{row.no_hp || '-'}</Typography></TableCell>
                  <TableCell>
                    <Chip label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Fak'} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={STATUS_CONFIG[row.status]?.label || row.status} size="small" color={STATUS_CONFIG[row.status]?.color || 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/penjualan/interior/${row.id}`} style={{ textDecoration: 'none' }}>
                      <Button size="small" variant="outlined" startIcon={<Eye size={14} />} sx={{ borderRadius: '8px', fontWeight: 700 }}>Detail</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248,250,252,0.5)' }}>
          <Typography variant="caption" color="text.secondary">Total {total} proyek</Typography>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }} />
        </Box>
      </Paper>
    </Box>
  );
}
