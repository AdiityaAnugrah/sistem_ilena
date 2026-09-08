'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Box, Button, Chip, CircularProgress, IconButton, Paper, Switch, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type OnlineOption = { id:number; tipe:'PLATFORM'|'METODE_PEMBAYARAN'; nama:string; active:number };

function OptionSection({ title, tipe }: { title:string; tipe:'PLATFORM'|'METODE_PEMBAYARAN' }) {
  const [rows, setRows] = useState<OnlineOption[]>([]);
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try { const res = await api.get('/online-options', { params: { tipe } }); setRows(res.data || []); }
    catch { toast.error(`Gagal memuat ${title}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchRows(); }, []);

  const add = async () => {
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    setSaving(true);
    try { await api.post('/online-options', { tipe, nama }); toast.success('Berhasil ditambahkan'); setNama(''); fetchRows(); }
    catch (err:any) { toast.error(err.response?.data?.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };
  const toggle = async (row: OnlineOption) => {
    try { await api.patch(`/online-options/${row.id}`, { active: row.active ? 0 : 1 }); fetchRows(); }
    catch { toast.error('Gagal update status'); }
  };
  const remove = async (row: OnlineOption) => {
    if (!confirm(`Hapus ${row.nama}?`)) return;
    try { await api.delete(`/online-options/${row.id}`); toast.success('Berhasil dihapus'); fetchRows(); }
    catch { toast.error('Gagal hapus'); }
  };

  return <Paper sx={{ p:3, borderRadius:'18px', border:'1px solid', borderColor:'divider', boxShadow:'none' }}>
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2 }}>
      <Typography sx={{ fontWeight:800, fontSize:18 }}>{title}</Typography>
      <Chip label={`${rows.length} data`} size="small" />
    </Box>
    <Box sx={{ display:'flex', gap:1.5, mb:2.5 }}>
      <TextField fullWidth size="small" label={`Tambah ${title}`} value={nama} onChange={e => setNama(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius:'10px' } }} />
      <Button variant="contained" disabled={saving} onClick={add} startIcon={<Plus size={16}/>} sx={{ borderRadius:'10px', bgcolor:'#FA2F2F', '&:hover':{ bgcolor:'#d41a1a' } }}>Tambah</Button>
    </Box>
    {loading ? <Box sx={{ py:4, textAlign:'center' }}><CircularProgress size={24}/></Box> : <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
      {rows.map(row => <Box key={row.id} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2, p:1.5, border:'1px solid #eef2f7', borderRadius:'12px', bgcolor: row.active ? '#fff' : '#f8fafc' }}>
        <Box><Typography sx={{ fontWeight:700, color:'#0f172a' }}>{row.nama}</Typography><Typography sx={{ fontSize:12, color:'#94a3b8' }}>{row.active ? 'Aktif di dropdown' : 'Nonaktif'}</Typography></Box>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}><Switch checked={!!row.active} onChange={() => toggle(row)} size="small"/><IconButton color="error" onClick={() => remove(row)}><Trash2 size={16}/></IconButton></Box>
      </Box>)}
    </Box>}
  </Paper>;
}

export default function MasterOnlinePage() {
  return <Box sx={{ p:{ xs:0, md:4 }, maxWidth:1200, mx:'auto' }}>
    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:3 }}><Settings2 size={28} color="#FA2F2F"/><Box><Typography variant="h4" sx={{ fontWeight:800, fontSize:{ xs:26, md:34 } }}>Master Online</Typography><Typography color="text.secondary" sx={{ fontSize:14 }}>Kelola pilihan Platform Online dan Metode Pembayaran Online.</Typography></Box></Box>
    <Grid container spacing={3}><Grid size={{ xs:12, md:6 }}><OptionSection title="Platform Online" tipe="PLATFORM" /></Grid><Grid size={{ xs:12, md:6 }}><OptionSection title="Metode Pembayaran Online" tipe="METODE_PEMBAYARAN" /></Grid></Grid>
  </Box>;
}
