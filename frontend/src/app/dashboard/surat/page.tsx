'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, InputAdornment, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Pagination, Chip, IconButton,
} from '@mui/material';
import { Search, FileText, RefreshCw } from 'lucide-react';

const TIPE_CONFIG: Record<string, { color: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error'; label: string }> = {
  'Surat Jalan':     { color: 'primary',   label: 'Surat Jalan' },
  'Invoice':         { color: 'success',   label: 'Invoice' },
  'Surat Pengantar': { color: 'warning',   label: 'Surat Pengantar' },
  'Proforma':        { color: 'secondary', label: 'Proforma' },
};

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
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
      const params: Record<string, any> = { page: p, limit: 20 };
      if (s) params.search = s;
      if (t) params.tipe = t;
      const res = await api.get('/public/surat', { params });
      let rows = res.data.data;
      if (sumber) rows = rows.filter((r: any) => r.sumber === sumber);
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

  const goToDetail = (row: any) => {
    if (row.sumber === 'OFFLINE') router.push(`/dashboard/penjualan/offline/${row.penjualan_id}`);
    else router.push(`/dashboard/penjualan/interior/${row.penjualan_id}`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <FileText size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Semua Dokumen</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Total {total} dokumen — Surat Jalan, Invoice, Surat Pengantar, Proforma
          </Typography>
        </Box>
        <Chip label={`${total} Dokumen`} variant="outlined" sx={{ fontWeight: 700, borderRadius: '8px' }} />
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 3, bgcolor: 'rgba(248,250,252,0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <form onSubmit={handleSearch}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Cari Nomor / Nama</Typography>
                <TextField
                  fullWidth size="small" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Contoh: 0006/SJ, Home Gallery..."
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, sx: { borderRadius: '10px', bgcolor: '#fff' } } }}
                />
              </Box>
              <Box sx={{ minWidth: 160 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Tipe Dokumen</Typography>
                <FormControl fullWidth size="small">
                  <Select value={tipeFilter} displayEmpty onChange={e => { setTipeFilter(e.target.value); setPage(1); fetchData(search, 1, e.target.value, sumberFilter); }} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua Tipe</MenuItem>
                    <MenuItem value="Surat Jalan">Surat Jalan</MenuItem>
                    <MenuItem value="Invoice">Invoice</MenuItem>
                    <MenuItem value="Surat Pengantar">Surat Pengantar</MenuItem>
                    <MenuItem value="Proforma">Proforma</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Sumber</Typography>
                <FormControl fullWidth size="small">
                  <Select value={sumberFilter} displayEmpty onChange={e => { setSumberFilter(e.target.value); setPage(1); fetchData(search, 1, tipeFilter, e.target.value); }} sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="OFFLINE">Offline</MenuItem>
                    <MenuItem value="INTERIOR">Interior</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <IconButton onClick={reset} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', height: 40 }}>
                  <RefreshCw size={18} />
                </IconButton>
              </Box>
            </Box>
          </form>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 700 }}>
            <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
              <TableRow>
                {['Nomor Dokumen', 'Tipe', 'Sumber', 'Nama Penerima', 'Tanggal'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}>Tidak ada dokumen ditemukan.</TableCell></TableRow>
              ) : data.map((row, idx) => (
                <TableRow
                  key={idx}
                  hover
                  onClick={() => goToDetail(row)}
                  sx={{ cursor: 'pointer', '& td': { py: 1.5 } }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
                      {row.nomor}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TIPE_CONFIG[row.tipe]?.label || row.tipe}
                      size="small"
                      color={TIPE_CONFIG[row.tipe]?.color || 'default'}
                      sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }}
                    />
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
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{row.nama_penerima}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{formatDate(row.tanggal)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248,250,252,0.5)' }}>
          <Typography variant="caption" color="text.secondary">Total {total} dokumen</Typography>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }} />
        </Box>
      </Paper>
    </Box>
  );
}
