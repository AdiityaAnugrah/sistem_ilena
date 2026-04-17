'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { 
  Box, 
  Typography, 
  Button, 
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
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  CircularProgress, 
  Tooltip, 
  Pagination,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { 
  Search, 
  Plus, 
  Pencil, 
  Power, 
  X, 
  Filter, 
  Package, 
  Tag, 
  DollarSign, 
  Layers, 
  ExternalLink,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Barang {
  id: string;
  nama: string;
  kategori: string;
  subkategori: string;
  harga: number;
  rate: number;
  diskon: number;
  pakai_jadwal_diskon: number;
  diskon_mulai: string | null;
  diskon_selesai: string | null;
  active: number;
  varian: string | null;
  deskripsi: string | null;
  shopee: string | null;
  tokped: string | null;
  tiktok: string | null;
  ruang_tamu: number;
  ruang_keluarga: number;
  ruang_tidur: number;
}

function parseDimensi(deskripsi: string | null): string {
  try {
    const d = deskripsi ? JSON.parse(deskripsi) : null;
    if (d?.dimensi?.asli) {
      const { panjang, lebar, tinggi } = d.dimensi.asli;
      const parts = [panjang, lebar, tinggi].filter(v => v && Number(v) > 0);
      if (parts.length > 0) return parts.join(' × ') + ' mm';
    }
  } catch { /* */ }
  return '-';
}

interface VarianItem { id: string; nama: string; kode: string; }

const emptyForm = {
  id: '', nama: '', kategori: '', subkategori: '',
  harga: '', diskon: '', rate: '',
  pakai_jadwal_diskon: 0, diskon_mulai: '', diskon_selesai: '',
  panjang: '', lebar: '', tinggi: '',
  shopee: '', tokped: '', tiktok: '',
  ruang_tamu: 0, ruang_keluarga: 0, ruang_tidur: 0,
  active: 1,
};

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function MasterBarangPage() {
  const [barangs, setBarangs] = useState<Barang[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Barang | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [varians, setVarians] = useState<VarianItem[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchBarangs = async (
    s = search, p = page, lim = limit,
    status = filterStatus, kat = filterKategori,
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: lim };
      if (s.trim()) params.search = s.trim();
      if (status !== '') params.active = status;
      if (kat.trim()) params.kategori = kat.trim();
      const res = await api.get('/barang', { params });
      setBarangs(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      
      const cats: string[] = res.data.data.map((b: Barang) => b.kategori).filter(Boolean);
      setKategoriList(prev => {
        const merged = Array.from(new Set([...prev, ...cats])).sort();
        return merged;
      });
    } catch {
      toast.error('Gagal mengambil data produk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBarangs(); }, [page, limit]);

  const applyFilters = () => {
    setPage(1);
    fetchBarangs(search, 1, limit, filterStatus, filterKategori);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterKategori('');
    setPage(1);
    fetchBarangs('', 1, limit, '', '');
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setVarians([]);
    setModalOpen(true);
  };

  const openEdit = (b: Barang) => {
    setEditTarget(b);
    let dim = { panjang: '', lebar: '', tinggi: '' };
    try {
      const d = typeof b.deskripsi === 'string' ? JSON.parse(b.deskripsi) : b.deskripsi;
      if (d?.dimensi?.asli) {
        dim = {
          panjang: String(d.dimensi.asli.panjang || ''),
          lebar: String(d.dimensi.asli.lebar || ''),
          tinggi: String(d.dimensi.asli.tinggi || ''),
        };
      }
    } catch { /* */ }
    let parsedVarian: VarianItem[] = [];
    try { parsedVarian = b.varian ? JSON.parse(b.varian) : []; } catch { /* */ }
    setVarians(parsedVarian);
    setForm({
      id: b.id, nama: b.nama || '', kategori: b.kategori || '', subkategori: b.subkategori || '',
      harga: String(b.harga || ''), diskon: String(b.diskon || ''), rate: String(b.rate || ''),
      pakai_jadwal_diskon: b.pakai_jadwal_diskon || 0,
      diskon_mulai: b.diskon_mulai ? b.diskon_mulai.slice(0, 16) : '',
      diskon_selesai: b.diskon_selesai ? b.diskon_selesai.slice(0, 16) : '',
      panjang: dim.panjang, lebar: dim.lebar, tinggi: dim.tinggi,
      shopee: b.shopee || '', tokped: b.tokped || '', tiktok: b.tiktok || '',
      ruang_tamu: b.ruang_tamu || 0, ruang_keluarga: b.ruang_keluarga || 0, ruang_tidur: b.ruang_tidur || 0,
      active: b.active,
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.id.trim() || !form.nama.trim()) { toast.error('ID dan Nama wajib diisi'); return; }
    setSaving(true);
    try {
      const deskripsi = (form.panjang || form.lebar || form.tinggi) ? {
        dimensi: { asli: { panjang: Number(form.panjang) || 0, lebar: Number(form.lebar) || 0, tinggi: Number(form.tinggi) || 0 } }
      } : undefined;
      const payload = {
        id: form.id.trim(), nama: form.nama.trim(),
        kategori: form.kategori.trim(), subkategori: form.subkategori.trim(),
        harga: Number(form.harga) || 0,
        rate: Number(form.rate) || 0,
        diskon: Number(form.diskon) || 0,
        pakai_jadwal_diskon: form.pakai_jadwal_diskon,
        diskon_mulai: form.pakai_jadwal_diskon && form.diskon_mulai ? form.diskon_mulai : null,
        diskon_selesai: form.pakai_jadwal_diskon && form.diskon_selesai ? form.diskon_selesai : null,
        varian: varians.length > 0 ? varians : [],
        deskripsi,
        shopee: form.shopee.trim() || '',
        tokped: form.tokped.trim() || '',
        tiktok: form.tiktok.trim() || '',
        ruang_tamu: form.ruang_tamu,
        ruang_keluarga: form.ruang_keluarga,
        ruang_tidur: form.ruang_tidur,
        active: form.active,
      };
      if (editTarget) {
        await api.put(`/barang/${editTarget.id}`, payload);
        toast.success('Barang berhasil diupdate');
      } else {
        await api.post('/barang', payload);
        toast.success('Barang berhasil ditambahkan');
      }
      closeModal();
      fetchBarangs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (b: Barang) => {
    try {
      await api.patch(`/barang/${b.id}/toggle-active`);
      toast.success(b.active ? 'Barang dinonaktifkan' : 'Barang diaktifkan');
      fetchBarangs();
    } catch { toast.error('Gagal mengubah status'); }
  };

  const addVarian = () => setVarians(prev => [...prev, { id: String(prev.length + 1).padStart(2, '0'), nama: '', kode: '#aaaaaa' }]);
  const removeVarian = (i: number) => setVarians(prev => prev.filter((_, idx) => idx !== i));
  const updateVarian = (i: number, key: keyof VarianItem, val: string) =>
    setVarians(prev => prev.map((v, idx) => idx === i ? { ...v, [key]: val } : v));
  const f = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Master Barang</Typography>
          <Typography variant="body2" color="text.secondary">{total} produk tersimpan dalam sistem</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Plus size={18} />} 
          onClick={openAdd}
          sx={{ borderRadius: '12px', px: 3, py: 1.2, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
        >
          Tambah Barang
        </Button>
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 3, bgcolor: 'rgba(248, 250, 252, 0.5)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cari nama, ID, kategori..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: '10px', bgcolor: '#fff' }
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="kat-label">Kategori</InputLabel>
                <Select
                  labelId="kat-label"
                  value={filterKategori}
                  label="Kategori"
                  onChange={e => setFilterKategori(e.target.value)}
                  sx={{ borderRadius: '10px', bgcolor: '#fff' }}
                >
                  <MenuItem value="">Semua Kategori</MenuItem>
                  {kategoriList.map(k => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={filterStatus}
                  label="Status"
                  onChange={e => setFilterStatus(e.target.value)}
                  sx={{ borderRadius: '10px', bgcolor: '#fff' }}
                >
                  <MenuItem value="">Semua Status</MenuItem>
                  <MenuItem value="1">Aktif</MenuItem>
                  <MenuItem value="0">Nonaktif</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="limit-label">Limit</InputLabel>
                <Select
                  labelId="limit-label"
                  value={limit}
                  label="Limit"
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  sx={{ borderRadius: '10px', bgcolor: '#fff' }}
                >
                  {LIMIT_OPTIONS.map(l => <MenuItem key={l} value={l}>{l} per Hal</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" fullWidth onClick={applyFilters} sx={{ borderRadius: '10px' }}>Filter</Button>
                {(search || filterKategori || filterStatus !== '') && (
                  <IconButton onClick={resetFilters} sx={{ bgcolor: '#fef2f2', color: 'error.main', borderRadius: '10px', '&:hover': { bgcolor: '#fee2e2' } }}>
                    <X size={20} />
                  </IconButton>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <TableRow>
                {['ID', 'Produk', 'Kategori', 'Dimensi', 'Harga', 'Diskon', 'Varian', 'Status', 'Aksi'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : barangs.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 10 }}>Produk tidak ditemukan</TableCell></TableRow>
              ) : barangs.map((b) => {
                let varianCount = 0;
                try { varianCount = b.varian ? JSON.parse(b.varian).length : 0; } catch { /* */ }
                return (
                  <TableRow key={b.id} sx={{ borderBottom: '1px solid rgba(226, 232, 240, 0.6)' }}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>{b.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.primary' }}>{b.nama}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ textTransform: 'capitalize', fontWeight: 600, color: 'primary.main' }}>{b.kategori}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{b.subkategori || '-'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                        {parseDimensi(b.deskripsi)}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatRupiah(b.harga)}</Typography></TableCell>
                    <TableCell>
                      {b.diskon ? <Chip label={`${b.diskon}%`} color="success" size="small" sx={{ fontWeight: 700, borderRadius: '6px' }} /> : '-'}
                    </TableCell>
                    <TableCell>
                      {varianCount > 0 ? <Chip label={`${varianCount} Varian`} color="primary" variant="outlined" size="small" sx={{ fontWeight: 600, borderRadius: '6px' }} /> : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={b.active ? 'Aktif' : 'Nonaktif'} 
                        color={b.active ? 'info' : 'default'} 
                        size="small" 
                        sx={{ fontWeight: 700, borderRadius: '6px' }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit Produk">
                          <IconButton size="small" onClick={() => openEdit(b)} sx={{ color: 'primary.main' }}><Pencil size={18} /></IconButton>
                        </Tooltip>
                        <Tooltip title={b.active ? 'Nonaktifkan' : 'Aktifkan'}>
                          <IconButton size="small" onClick={() => handleToggleActive(b)} sx={{ color: b.active ? 'error.main' : 'success.main' }}><Power size={18} /></IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Custom Pagination */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248, 250, 252, 0.5)' }}>
          <Typography variant="caption" color="text.secondary">Total {total} produk</Typography>
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

      {/* Edit/Add Modal */}
      <Dialog 
        open={modalOpen} 
        onClose={closeModal} 
        maxWidth="md" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: '24px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{editTarget ? 'Perbarui Data Produk' : 'Registrasi Produk Baru'}</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Informasi Utama</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="ID Produk" size="small" value={form.id} onChange={e => f('id', e.target.value)} disabled={!!editTarget} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Tag size={16} /></InputAdornment> } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField fullWidth label="Nama Produk" size="small" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Contoh: Lemari Sliding 2 Pintu" />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Kategori" size="small" value={form.kategori} onChange={e => f('kategori', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Sub Kategori" size="small" value={form.subkategori} onChange={e => f('subkategori', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Harga (Rp)" type="number" size="small" value={form.harga} onChange={e => f('harga', e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><DollarSign size={16} /></InputAdornment> } }} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Diskon (%)" type="number" size="small" value={form.diskon} onChange={e => f('diskon', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Rate (0-5)" type="number" size="small" value={form.rate} onChange={e => f('rate', e.target.value)} slotProps={{ htmlInput: { min: 0, max: 5 } }} />
                </Grid>
              </Grid>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Jadwal Diskon</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input type="checkbox" id="pakaiJadwal" checked={!!form.pakai_jadwal_diskon} onChange={e => f('pakai_jadwal_diskon', e.target.checked ? 1 : 0)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <label htmlFor="pakaiJadwal" style={{ fontSize: 13, cursor: 'pointer', color: '#475569' }}>Aktifkan jadwal diskon otomatis</label>
                  </Box>
                </Grid>
                {!!form.pakai_jadwal_diskon && (<>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth label="Mulai Diskon" type="datetime-local" size="small" value={form.diskon_mulai} onChange={e => f('diskon_mulai', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth label="Selesai Diskon" type="datetime-local" size="small" value={form.diskon_selesai} onChange={e => f('diskon_selesai', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                  </Grid>
                </>)}
              </Grid>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Kategori Ruangan</Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                {([['ruang_tamu', 'Ruang Tamu'], ['ruang_keluarga', 'Ruang Keluarga'], ['ruang_tidur', 'Ruang Tidur']] as [string, string][]).map(([key, label]) => (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input type="checkbox" id={key} checked={!!(form as any)[key]} onChange={e => f(key, e.target.checked ? 1 : 0)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <label htmlFor={key} style={{ fontSize: 13, cursor: 'pointer', color: '#475569' }}>{label}</label>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Dimensi (mm)</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 4 }}><TextField fullWidth label="Panjang" size="small" value={form.panjang} onChange={e => f('panjang', e.target.value)} /></Grid>
                <Grid size={{ xs: 4 }}><TextField fullWidth label="Lebar" size="small" value={form.lebar} onChange={e => f('lebar', e.target.value)} /></Grid>
                <Grid size={{ xs: 4 }}><TextField fullWidth label="Tinggi" size="small" value={form.tinggi} onChange={e => f('tinggi', e.target.value)} /></Grid>
              </Grid>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Varian Warna</Typography>
                <Button size="small" startIcon={<Plus size={14} />} onClick={addVarian} sx={{ borderRadius: '8px' }}>Tambah Varian</Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {varians.length === 0 ? (
                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', p: 1 }}>Belum ada varian warna ditentukan</Typography>
                ) : varians.map((v, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1, px: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.02)' }}>
                    <input type="color" value={v.kode} onChange={e => updateVarian(i, 'kode', e.target.value)} style={{ width: 24, height: 24, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }} />
                    <TextField variant="standard" size="small" value={v.nama} onChange={e => updateVarian(i, 'nama', e.target.value)} placeholder="Nama" sx={{ width: 100 }} slotProps={{ input: { sx: { fontSize: '0.75rem' } } }} />
                    <IconButton size="small" onClick={() => removeVarian(i)} sx={{ color: 'error.light' }}><X size={14} /></IconButton>
                  </Paper>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800, letterSpacing: '0.1em' }}>Integrasi Marketplace (URL)</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Shopee" size="small" value={form.shopee} onChange={e => f('shopee', e.target.value)} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Tokopedia" size="small" value={form.tokped} onChange={e => f('tokped', e.target.value)} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="TikTok" size="small" value={form.tiktok} onChange={e => f('tiktok', e.target.value)} /></Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={closeModal} color="inherit" sx={{ fontWeight: 600 }}>Tutup</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ px: 4, borderRadius: '12px' }}>
            {saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Perbarui Barang' : 'Simpan Barang'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
