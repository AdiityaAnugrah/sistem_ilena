'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Pagination, Button, Tabs, Tab,
} from '@mui/material';
import { Plus, Eye, RefreshCw, Store, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DisplayPage() {
  const [tab, setTab] = useState(0);

  // Display Aktif
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Sudah Laku
  const [lakuData, setLakuData] = useState<any[]>([]);
  const [lakuLoading, setLakuLoading] = useState(false);

  const fetchDisplay = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: { tipe: 'DISPLAY', page: p, limit: 20 } });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch {
      toast.error('Gagal memuat data display');
    } finally {
      setLoading(false);
    }
  };

  const fetchLaku = async () => {
    setLakuLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: { from_display: '1', tipe: 'PENJUALAN', page: 1, limit: 100 } });
      setLakuData(res.data.data || []);
    } catch {
      setLakuData([]);
    } finally {
      setLakuLoading(false);
    }
  };

  useEffect(() => { fetchDisplay(); }, [page]);
  useEffect(() => { if (tab === 1) fetchLaku(); }, [tab]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Store size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Display</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Kelola barang display toko</Typography>
        </Box>
        <Link href="/dashboard/display/baru" style={{ textDecoration: 'none' }}>
          <Button variant="contained" startIcon={<Plus size={18} />} sx={{ borderRadius: '12px', px: 3, py: 1.2, boxShadow: '0 4px 12px rgba(250,47,47,0.25)', bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>
            Display Baru
          </Button>
        </Link>
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit"
            sx={{ '& .MuiTabs-indicator': { backgroundColor: '#FA2F2F' }, '& .MuiTab-root': { fontWeight: 700, fontSize: '0.8rem', textTransform: 'none', minHeight: 48 }, '& .Mui-selected': { color: '#FA2F2F' } }}>
            <Tab icon={<Store size={15} />} iconPosition="start" label="Display Aktif" />
            <Tab icon={<ShoppingBag size={15} />} iconPosition="start" label="Sudah Laku" />
          </Tabs>
        </Box>

        {/* Tab 0: Display Aktif */}
        {tab === 0 && (
          <>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'rgba(248,250,252,0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">Total: <strong>{total}</strong> display aktif</Typography>
            </Box>
            <TableContainer>
              <Table sx={{ minWidth: 700 }}>
                <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
                  <TableRow>
                    {['Tanggal', 'Nama Penerima', 'No. Surat Pengantar', 'Status', 'Aksi'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : data.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 10 }}>Tidak ada data display.</TableCell></TableRow>
                  ) : data.map((row: any) => (
                    <TableRow key={row.id} hover sx={{ '& td': { py: 1.8 } }}>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.tanggal)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.nama_penerima}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: row.suratPengantars?.length ? 'text.primary' : 'text.disabled' }}>
                          {row.suratPengantars?.map((sp: any) => sp.nomor_sp).join(', ') || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.status} size="small" color={row.status === 'ACTIVE' ? 'info' : 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
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
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248,250,252,0.5)' }}>
              <Typography variant="caption" color="text.secondary">Total {total} display</Typography>
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }} />
            </Box>
          </>
        )}

        {/* Tab 1: Sudah Laku */}
        {tab === 1 && (
          <>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'rgba(248,250,252,0.5)', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Total: <strong>{lakuData.length}</strong> penjualan dari display</Typography>
              <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} className={lakuLoading ? 'animate-spin' : ''} />} onClick={fetchLaku} disabled={lakuLoading} sx={{ borderRadius: '8px', fontWeight: 700 }}>
                Refresh
              </Button>
            </Box>
            <TableContainer>
              <Table sx={{ minWidth: 700 }}>
                <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
                  <TableRow>
                    {['Tanggal Laku', 'Nama Penerima', 'Faktur', 'Total Nilai', 'Status', 'Aksi'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lakuLoading ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : lakuData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}>Belum ada barang display yang terjual.</TableCell></TableRow>
                  ) : lakuData.map((row: any) => {
                    const totalNilai = (row.items || []).reduce((s: number, i: any) => s + parseFloat(i.subtotal || 0), 0);
                    return (
                      <TableRow key={row.id} hover sx={{ '& td': { py: 1.8 } }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.suratJalans?.[0]?.tanggal || row.tanggal)}</Typography></TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.nama_penerima}</Typography></TableCell>
                        <TableCell>
                          <Chip label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Fak'} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{formatRupiah(totalNilai)}</Typography></TableCell>
                        <TableCell>
                          <Chip label={row.status} size="small" color={row.status === 'ACTIVE' ? 'info' : 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/penjualan/offline/${row.id}`} style={{ textDecoration: 'none' }}>
                            <Button size="small" variant="outlined" startIcon={<Eye size={14} />} sx={{ borderRadius: '8px', fontWeight: 700 }}>Detail</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
}
