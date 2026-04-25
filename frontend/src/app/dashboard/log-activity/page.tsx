'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import useAuthStore from '@/store/authStore';
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
  Chip,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Pagination,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  History,
  Search,
  Calendar,
  User,
  Activity,
  Filter,
  RefreshCw,
  Info
} from 'lucide-react';

export default function LogActivityPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    if (user && user.role !== 'DEV') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/log-activity', { params: { page: p, limit: 50, from, to, action } });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch {
      // silently fail or handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  if (user?.role !== 'DEV') return null;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <History size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Log Aktivitas</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Rekaman jejak operasional sistem • <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>Akses Terbatas: DEV Only</Box>
          </Typography>
        </Box>
        <Chip label={`${total} Entri Log`} variant="outlined" sx={{ fontWeight: 700, borderRadius: '8px' }} />
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 3, bgcolor: 'rgba(248, 250, 252, 0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Dari Tanggal</Typography>
              <TextField 
                type="date"
                size="small"
                fullWidth
                value={from}
                onChange={e => setFrom(e.target.value)}
                slotProps={{ htmlInput: { lang: 'id-ID' }, input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }}
              />
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Sampai Tanggal</Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={to}
                onChange={e => setTo(e.target.value)}
                slotProps={{ htmlInput: { lang: 'id-ID' }, input: { sx: { borderRadius: '10px', bgcolor: '#fff' } } }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 250 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', mb: 1, display: 'block' }}>Pencarian Aksi</Typography>
              <TextField 
                size="small" 
                fullWidth 
                value={action} 
                placeholder="Contoh: update_barang, login, dll"
                onChange={e => setAction(e.target.value)}
                slotProps={{ 
                  input: { 
                    startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                    sx: { borderRadius: '10px', bgcolor: '#fff' } 
                  } 
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                onClick={() => { setPage(1); fetchData(1); }}
                sx={{ borderRadius: '10px', px: 3 }}
              >
                Terapkan
              </Button>
              <IconButton 
                onClick={() => { setFrom(''); setTo(''); setAction(''); setTimeout(() => fetchData(1), 100); }}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
              >
                <RefreshCw size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Waktu</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Aksi</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Detail Aktivitas</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}>Belum ada rekaman aktivitas.</TableCell></TableRow>
              ) : data.map((log: any) => (
                <TableRow key={log.id} hover sx={{ '& td': { py: 1.5 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Calendar size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{formatDateTime(log.created_at)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <User size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{log.user?.username || '-'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={log.user?.role} 
                      size="small" 
                      color={log.user?.role === 'DEV' ? 'error' : 'secondary'} 
                      variant="soft" 
                      sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Activity size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.04)', px: 1, py: 0.2, borderRadius: '4px', textTransform: 'capitalize' }}>
                        {log.action?.replace(/_/g, ' ')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Info size={14} style={{ opacity: 0.5 }} />
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ textTransform: 'capitalize' }}>{log.detail || '-'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">{log.ip_address || '-'}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248, 250, 252, 0.5)' }}>
          <Typography variant="caption" color="text.secondary">Halaman {page} dari {totalPages}</Typography>
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
