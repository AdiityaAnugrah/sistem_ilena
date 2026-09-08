'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel, CircularProgress, Pagination, Button } from '@mui/material';
import Grid from '@mui/material/Grid';
import { Search, Eye, Plus, RefreshCw, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useListSync } from '@/hooks/useListSync';

type OnlineRow = { id:number; id_pesanan:string; faktur:string; channel:string; nama_pelanggan:string; no_hp:string; tanggal:string; status:string; total_tagihan:number; total_bayar:number; qty_net:number; };
const STATUS: Record<string, { label:string; color:'default'|'primary'|'secondary'|'error'|'info'|'success'|'warning' }> = {
  DIPROSES: { label:'Diproses', color:'warning' }, DIKIRIM: { label:'Dikirim', color:'info' }, SELESAI: { label:'Selesai', color:'success' }, DIBATALKAN: { label:'Dibatalkan', color:'error' }, RETUR: { label:'Retur', color:'secondary' },
};

export default function PenjualanOnlinePage() {
  const [data, setData] = useState<OnlineRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalNilai: 0, totalBayar: 0, totalRetur: 0, totalQty: 0 });
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (search) params.search = search;
      if (platform) params.channel = platform;
      if (status) params.status = status;
      if (tanggalDari) params.tanggal_dari = tanggalDari;
      if (tanggalSampai) params.tanggal_sampai = tanggalSampai;
      const res = await api.get('/penjualan-online', { params });
      setData(res.data.data || []); setTotal(res.data.total || 0); setTotalPages(res.data.totalPages || 1); setSummary(res.data.summary || summary);
    } catch { toast.error('Gagal memuat penjualan online'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, platform, status, tanggalDari, tanggalSampai]);
  useListSync('penjualan-online-list', () => fetchData());
  const reset = () => { setSearch(''); setPlatform(''); setStatus(''); setTanggalDari(''); setTanggalSampai(''); setPage(1); };

  return <Box sx={{ p: { xs: 0, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:{ xs:'stretch', sm:'center' }, mb:{ xs:2, md:4 }, gap:2, flexDirection:{ xs:'column', sm:'row' } }}>
      <Box><Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:.5 }}><ShoppingCart size={28} style={{ color:'#FA2F2F' }} /><Typography variant="h4" sx={{ fontWeight:800, fontSize:{ xs:26, md:34 } }}>Penjualan Online</Typography></Box><Typography variant="body2" color="text.secondary">Total {total} pesanan online tercatat</Typography></Box>
      <Link href="/dashboard/penjualan/online/baru" style={{ textDecoration:'none' }}><Button fullWidth variant="contained" startIcon={<Plus size={18}/>} sx={{ borderRadius:'12px', px:3, py:1.2, bgcolor:'#FA2F2F', '&:hover':{ bgcolor:'#d41a1a' } }}>Pesanan Online Baru</Button></Link>
    </Box>
    <Paper sx={{ borderRadius:{ xs:'16px', md:'20px' }, overflow:'hidden', border:'1px solid', borderColor:'divider', boxShadow:'none' }}>
      <Box sx={{ p:{ xs:2, md:3 }, bgcolor:'rgba(248,250,252,.5)', borderBottom:'1px solid', borderColor:'divider' }}>
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData(1); }}><Grid container spacing={2} sx={{ alignItems:'flex-end' }}>
          <Grid size={{ xs:12, md:3 }}><Typography variant="caption" sx={{ fontWeight:700, color:'text.disabled', mb:1, display:'block' }}>ID Pesanan / Pelanggan / Resi</Typography><TextField fullWidth size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." slotProps={{ input:{ startAdornment:<InputAdornment position="start"><Search size={16}/></InputAdornment>, sx:{ borderRadius:'10px', bgcolor:'#fff' } } }}/></Grid>
          <Grid size={{ xs:6, md:1.5 }}><Typography variant="caption" sx={{ fontWeight:700, color:'text.disabled', mb:1, display:'block' }}>Dari</Typography><DateInput value={tanggalDari} onChange={e => setTanggalDari(e.target.value)} style={{ width:'100%', padding:'7px 12px', borderRadius:'10px', background:'#fff', border:'1px solid #e0e0e0', fontSize:14 }}/></Grid>
          <Grid size={{ xs:6, md:1.5 }}><Typography variant="caption" sx={{ fontWeight:700, color:'text.disabled', mb:1, display:'block' }}>Ke</Typography><DateInput value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)} style={{ width:'100%', padding:'7px 12px', borderRadius:'10px', background:'#fff', border:'1px solid #e0e0e0', fontSize:14 }}/></Grid>
          <Grid size={{ xs:6, md:2 }}><Typography variant="caption" sx={{ fontWeight:700, color:'text.disabled', mb:1, display:'block' }}>Platform</Typography><TextField fullWidth size="small" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }} placeholder="Semua platform" sx={{ '& .MuiOutlinedInput-root': { borderRadius:'10px', bgcolor:'#fff' } }} /></Grid>
          <Grid size={{ xs:6, md:2 }}><FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }} sx={{ borderRadius:'10px', bgcolor:'#fff' }}><MenuItem value="">Semua</MenuItem>{Object.entries(STATUS).map(([k,v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl></Grid>
          <Grid size={{ xs:12, md:2 }}><Box sx={{ display:'flex', gap:1 }}><Button variant="contained" type="submit" sx={{ borderRadius:'10px', flex:1, bgcolor:'#FA2F2F' }}>Cari</Button><IconButton onClick={reset} sx={{ border:'1px solid', borderColor:'divider', borderRadius:'10px' }}><RefreshCw size={18}/></IconButton></Box></Grid>
        </Grid></form>
      </Box>
      <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', md:'repeat(4,1fr)' }, gap:1.5, p:2, bgcolor:'#fff' }}>
        <Chip label={`Nilai ${formatRupiah(summary.totalNilai)}`} color="primary" variant="outlined" />
        <Chip label={`Terbayar ${formatRupiah(summary.totalBayar)}`} color="success" variant="outlined" />
        <Chip label={`Retur ${formatRupiah(summary.totalRetur)}`} color="warning" variant="outlined" />
        <Chip label={`Qty ${summary.totalQty}`} variant="outlined" />
      </Box>
      <TableContainer><Table><TableHead><TableRow><TableCell>ID Pesanan</TableCell><TableCell>Tanggal</TableCell><TableCell>Pelanggan</TableCell><TableCell>Platform</TableCell><TableCell>Faktur</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell><TableCell align="center">Aksi</TableCell></TableRow></TableHead><TableBody>
        {loading ? <TableRow><TableCell colSpan={8} align="center" sx={{ py:6 }}><CircularProgress size={28}/></TableCell></TableRow> : data.length === 0 ? <TableRow><TableCell colSpan={8} align="center" sx={{ py:6 }}>Belum ada data online.</TableCell></TableRow> : data.map(row => <TableRow key={row.id} hover><TableCell><b>{row.id_pesanan}</b></TableCell><TableCell>{formatDate(row.tanggal)}</TableCell><TableCell>{row.nama_pelanggan}<br/><Typography variant="caption" color="text.secondary">{row.no_hp}</Typography></TableCell><TableCell><Chip size="small" label={row.channel}/></TableCell><TableCell><Chip size="small" label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'} variant="outlined"/></TableCell><TableCell align="right" sx={{ fontWeight:700 }}>{formatRupiah(row.total_tagihan)}</TableCell><TableCell><Chip size="small" label={STATUS[row.status]?.label || row.status} color={STATUS[row.status]?.color || 'default'}/></TableCell><TableCell align="center"><Link href={`/dashboard/penjualan/online/${row.id}`}><IconButton><Eye size={18}/></IconButton></Link></TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
      {totalPages > 1 && <Box sx={{ p:2, display:'flex', justifyContent:'center' }}><Pagination count={totalPages} page={page} onChange={(_,v) => setPage(v)} color="primary" /></Box>}
    </Paper>
  </Box>;
}
