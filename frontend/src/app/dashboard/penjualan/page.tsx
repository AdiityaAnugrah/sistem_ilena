'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { 
  Box, 
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Pagination,
  Button
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Search,
  Eye,
  Calendar,
  User,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PenjualanRow {
  id: number;
  tanggal: string;
  nama_customer: string;
  no_po: string | null;
  sumber: 'OFFLINE' | 'INTERIOR';
  faktur: string;
  status: string;
  jumlah_item: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" }> = {
  DRAFT:     { label: 'Draft',    color: 'default' },
  ACTIVE:    { label: 'Aktif',    color: 'info' },
  COMPLETED: { label: 'Selesai', color: 'success' },
};

type SumberFilter = '' | 'OFFLINE' | 'INTERIOR';
type StatusFilter = '' | 'DRAFT' | 'ACTIVE' | 'COMPLETED';
type FakturFilter = '' | 'FAKTUR' | 'NON_FAKTUR';

export default function SemuaPenjualanPage() {
  const [data, setData] = useState<PenjualanRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [sumberFilter, setSumberFilter] = useState<SumberFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [fakturFilter, setFakturFilter] = useState<FakturFilter>('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');

  const fetchData = async (
    s = search,
    p = page,
    sumber = sumberFilter,
    status = statusFilter,
    faktur = fakturFilter,
    dari = tanggalDari,
    sampai = tanggalSampai,
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (s)      params.search        = s;
      if (sumber) params.sumber        = sumber;
      if (status) params.status        = status;
      if (faktur) params.faktur        = faktur;
      if (dari)   params.tanggal_dari  = dari;
      if (sampai) params.tanggal_sampai = sampai;

      const res = await api.get('/penjualan/semua', { params });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch {
      toast.error('Gagal memuat data penjualan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, sumberFilter, statusFilter, fakturFilter, tanggalDari, tanggalSampai]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const resetFilters = () => {
    setSearch('');
    setSumberFilter('');
    setStatusFilter('');
    setFakturFilter('');
    setTanggalDari('');
    setTanggalSampai('');
    setPage(1);
  };

  const getDetailHref = (row: PenjualanRow) => {
    if (row.sumber === 'OFFLINE') return `/dashboard/penjualan/offline/${row.id}`;
    return `/dashboard/penjualan/interior/${row.id}`;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <ShoppingBag size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Semua Penjualan</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Total {total} transaksi tercatat dalam sistem</Typography>
        </Box>
        <Chip label="Data Terpusat" color="primary" variant="outlined" sx={{ fontWeight: 700, borderRadius: '8px' }} />
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 3, bgcolor: 'rgba(248, 250, 252, 0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <form onSubmit={handleSearch}>
            <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Customer / No. PO</Typography>
                <TextField
                  fullWidth size="small" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari..."
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                      sx: { borderRadius: '10px', bgcolor: '#fff' }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Dari</Typography>
                <TextField type="date" fullWidth size="small" value={tanggalDari} onChange={e => setTanggalDari(e.target.value)} inputProps={{ lang: 'id-ID' }} slotProps={{ input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Ke</Typography>
                <TextField type="date" fullWidth size="small" value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)} inputProps={{ lang: 'id-ID' }} slotProps={{ input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="kat-label">Sumber</InputLabel>
                  <Select labelId="kat-label" value={sumberFilter} label="Sumber" onChange={e => setSumberFilter(e.target.value as SumberFilter)} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="OFFLINE">Offline</MenuItem>
                    <MenuItem value="INTERIOR">Interior</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="stat-label">Status</InputLabel>
                  <Select labelId="stat-label" value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value as StatusFilter)} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="ACTIVE">Aktif</MenuItem>
                    <MenuItem value="COMPLETED">Selesai</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" type="submit" sx={{ borderRadius: '10px', flex: 1 }}>Cari</Button>
                  <IconButton onClick={resetFilters} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}><RefreshCw size={18} /></IconButton>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 1000 }}>
            <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <TableRow>
                {['Tanggal', 'Nama Customer', 'No. PO', 'Kategori', 'Faktur', 'Status', 'Items', 'Aksi'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}>Belum ada data penjualan.</TableCell></TableRow>
              ) : data.map((row) => (
                <TableRow key={row.id} hover sx={{ '& td': { py: 1.8 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Calendar size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.tanggal)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <User size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'capitalize', color: 'text.primary' }}>{row.nama_customer}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>{row.no_po || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.sumber}
                      size="small"
                      variant="outlined"
                      color={row.sumber === 'INTERIOR' ? 'secondary' : 'primary'}
                      sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Fak'} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={STATUS_CONFIG[row.status]?.label || row.status} 
                      size="small" 
                      color={STATUS_CONFIG[row.status]?.color || 'default'}
                      sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.jumlah_item}</Typography>
                  </TableCell>
                  <TableCell>
                    <Link href={getDetailHref(row)} style={{ textDecoration: 'none' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Eye size={16} />}
                        sx={{ borderRadius: '8px', fontWeight: 700 }}
                      >
                        Detail
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248, 250, 252, 0.5)' }}>
          <Typography variant="caption" color="text.secondary">Total {total} Transaksi</Typography>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={(_, v) => setPage(v)} 
            color="primary" 
            size="small"
            sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
