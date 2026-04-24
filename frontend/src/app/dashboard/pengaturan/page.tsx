'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import {
  Box, Typography, Paper, TextField, Button,
  Switch, FormControlLabel, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { Video, Save, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import TutorialVideoModal from '@/components/TutorialVideoModal';

interface TutorialConfig {
  youtube_url: string;
  start_second: number;
  end_second: number | null;
  active: boolean;
}

const EMPTY: TutorialConfig = { youtube_url: '', start_second: 0, end_second: null, active: true };

function mmssToSec(v: string): number {
  const parts = v.split(':').map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return Number(v) || 0;
}

function secToMmss(s: number | null | undefined): string {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function VideoCard({
  label, formType, onPreview,
}: {
  label: string;
  formType: string;
  onPreview: (url: string, start: number, end: number | null) => void;
}) {
  const [form, setForm] = useState<TutorialConfig>(EMPTY);
  const [startStr, setStartStr] = useState('0:00');
  const [endStr, setEndStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tutorial-video/${formType}`)
      .then(r => {
        setForm({ ...r.data, active: !!r.data.active });
        setStartStr(secToMmss(r.data.start_second) || '0:00');
        setEndStr(secToMmss(r.data.end_second));
      })
      .catch(() => { /* belum ada data, pakai EMPTY */ })
      .finally(() => setLoading(false));
  }, [formType]);

  const handleSave = async () => {
    if (!form.youtube_url.trim()) { toast.error('URL YouTube wajib diisi'); return; }
    const start = mmssToSec(startStr);
    const end = endStr.trim() ? mmssToSec(endStr) : null;
    if (end !== null && end <= start) { toast.error('Waktu selesai harus setelah waktu mulai'); return; }
    setSaving(true);
    try {
      await api.put(`/tutorial-video/${formType}`, {
        youtube_url: form.youtube_url.trim(),
        start_second: start,
        end_second: end,
        active: form.active ? 1 : 0,
      });
      toast.success('Disimpan!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: '14px', display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: '14px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Video size={17} color="#FA2F2F" />
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{label}</Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={form.active}
              onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
              size="small"
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#FA2F2F' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#FA2F2F' } }}
            />
          }
          label={<Typography sx={{ fontSize: 12 }} color="text.secondary">{form.active ? 'Aktif' : 'Nonaktif'}</Typography>}
          labelPlacement="start"
          sx={{ m: 0 }}
        />
      </Box>

      <TextField
        fullWidth label="URL YouTube" size="small" sx={{ mb: 2 }}
        placeholder="https://www.youtube.com/watch?v=..."
        value={form.youtube_url}
        onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField
          label="Mulai dari" size="small" sx={{ flex: 1 }}
          placeholder="0:00"
          value={startStr}
          onChange={e => setStartStr(e.target.value)}
          helperText="Format mm:ss  (contoh: 1:30)"
        />
        <TextField
          label="Sampai" size="small" sx={{ flex: 1 }}
          placeholder="Opsional"
          value={endStr}
          onChange={e => setEndStr(e.target.value)}
          helperText="Kosongkan = sampai akhir"
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="outlined" size="small" sx={{ borderRadius: '8px' }}
          disabled={!form.youtube_url.trim()}
          onClick={() => onPreview(form.youtube_url, mmssToSec(startStr), endStr.trim() ? mmssToSec(endStr) : null)}
        >
          Preview
        </Button>
        <Button
          variant="contained" size="small"
          startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <Save size={13} />}
          disabled={saving}
          onClick={handleSave}
          sx={{ borderRadius: '8px', bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}
        >
          Simpan
        </Button>
      </Box>
    </Paper>
  );
}

export default function PengaturanPage() {
  const { user } = useAuthStore();
  const [previewData, setPreviewData] = useState<{ url: string; start: number; end: number | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Hapus semua produksi — multi-step
  const [deleteAllStep, setDeleteAllStep] = useState(0); // 0=tutup, 1=warning, 2=ketik konfirmasi, 3=password
  const [deleteAllTyped, setDeleteAllTyped] = useState('');
  const [deleteAllPass, setDeleteAllPass] = useState('');
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  // Hapus per penjualan
  const [deleteSingle, setDeleteSingle] = useState<{ open: boolean; sumber: 'offline'|'interior'; idStr: string; preview: any|null; step: 1|2 }>({ open: false, sumber: 'offline', idStr: '', preview: null, step: 1 });
  const [deleteSinglePass, setDeleteSinglePass] = useState('');
  const [deleteSingleLoading, setDeleteSingleLoading] = useState(false);

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true);
    try {
      const res = await api.delete('/dev/penjualan-produksi', { data: { password: deleteAllPass } });
      toast.success(`Berhasil dihapus: ${res.data.deleted.offline} offline, ${res.data.deleted.interior} interior. Counter direset.`);
      setDeleteAllStep(0); setDeleteAllTyped(''); setDeleteAllPass('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    } finally { setDeleteAllLoading(false); }
  };

  const handleFetchPreview = async () => {
    const q = deleteSingle.idStr.trim();
    if (!q) return;
    try {
      let id = q;
      // Jika input bukan angka murni (mengandung '/'), cari by nomor dokumen dulu
      if (!/^\d+$/.test(q)) {
        const lookup = await api.get('/dev/penjualan-by-doc', { params: { sumber: deleteSingle.sumber, nomor: q } });
        id = String(lookup.data.penjualan_id);
        setDeleteSingle(p => ({ ...p, idStr: id }));
      }
      const res = await api.get(`/penjualan-${deleteSingle.sumber}/${id}`);
      setDeleteSingle(p => ({ ...p, idStr: id, preview: res.data, step: 2 }));
    } catch {
      toast.error('Dokumen tidak ditemukan');
    }
  };

  const handleDeleteSingle = async () => {
    setDeleteSingleLoading(true);
    try {
      await api.delete(`/dev/penjualan/${deleteSingle.sumber}/${deleteSingle.idStr}`, { data: { password: deleteSinglePass } });
      toast.success(`Penjualan #${deleteSingle.idStr} berhasil dihapus`);
      setDeleteSingle({ open: false, sumber: 'offline', idStr: '', preview: null, step: 1 });
      setDeleteSinglePass('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    } finally { setDeleteSingleLoading(false); }
  };

  const handleResetTestData = async () => {
    setResetting(true);
    try {
      const res = await api.delete('/dev/reset-test-data');
      toast.success(`Data testing dihapus: ${res.data.deleted.offline} offline, ${res.data.deleted.interior} interior`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus data');
    } finally {
      setResetting(false);
      setConfirmOpen(false);
    }
  };

  if (user?.role !== 'DEV') {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography sx={{ fontSize: 14 }}>Halaman ini hanya bisa diakses oleh DEV.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Pengaturan</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Konfigurasi video tutorial untuk setiap form penjualan.
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <VideoCard
          label="Tutorial — Penjualan Offline"
          formType="PENJUALAN_OFFLINE"
          onPreview={(url, start, end) => setPreviewData({ url, start, end })}
        />
        <VideoCard
          label="Tutorial — Penjualan Interior"
          formType="PENJUALAN_INTERIOR"
          onPreview={(url, start, end) => setPreviewData({ url, start, end })}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Paper variant="outlined" sx={{ p: 3, borderRadius: '14px', borderColor: '#fca5a5' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Trash2 size={17} color="#ef4444" />
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>Reset Data Testing</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: 13 }}>
          Hapus semua transaksi penjualan (offline & interior) yang dibuat dalam mode testing (is_test=1),
          termasuk seluruh dokumen terkait seperti Surat Jalan, Invoice, Proforma, dan Pembayaran.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<Trash2 size={14} />}
          onClick={() => setConfirmOpen(true)}
          sx={{ borderRadius: '8px' }}
        >
          Hapus Semua Data Testing
        </Button>
      </Paper>

      {previewData && (
        <TutorialVideoModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          youtubeUrl={previewData.url}
          startSecond={previewData.start}
          endSecond={previewData.end ?? undefined}
        />
      )}

      {/* ─── DANGER ZONE ─────────────────────────────────────────────────── */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ border: '2px solid #dc2626', borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ background: '#dc2626', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldAlert size={20} color="#fff" />
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '0.04em' }}>
            DANGER ZONE — Operasi Tidak Bisa Dibatalkan
          </Typography>
        </Box>

        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Card 1: Hapus semua produksi */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px', borderColor: '#fca5a5', background: '#fff5f5' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
              <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>Hapus Semua Data Penjualan Produksi</Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                  Menghapus <strong>seluruh</strong> transaksi offline & interior (is_test=0) beserta semua dokumen terkait
                  (SJ, Invoice, Proforma, SP, Pembayaran) dan mereset semua counter nomor dokumen ke 0.
                </Typography>
              </Box>
            </Box>
            <Button variant="contained" size="small" color="error" startIcon={<Trash2 size={13} />}
              onClick={() => setDeleteAllStep(1)} sx={{ borderRadius: '8px' }}>
              Hapus Semua Data Produksi
            </Button>
          </Paper>

          {/* Card 2: Hapus per penjualan */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px', borderColor: '#fcd34d', background: '#fffbeb' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>Hapus Satu Data Penjualan</Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                  Hapus satu transaksi beserta dokumennya. Nomor dokumen berikutnya akan otomatis disesuaikan
                  agar tidak ada celah urutan. Ini tidak bisa dikembalikan.
                </Typography>
              </Box>
            </Box>
            <Button variant="outlined" size="small" color="warning" startIcon={<Trash2 size={13} />}
              onClick={() => setDeleteSingle(p => ({ ...p, open: true }))}
              sx={{ borderRadius: '8px' }}>
              Pilih & Hapus Satu Penjualan
            </Button>
          </Paper>
        </Box>
      </Box>

      {/* ── Dialog: Hapus Semua Produksi (multi-step) ── */}
      <Dialog open={deleteAllStep > 0} onClose={() => !deleteAllLoading && (setDeleteAllStep(0), setDeleteAllTyped(''), setDeleteAllPass(''))} maxWidth="sm" fullWidth>
        {deleteAllStep === 1 && <>
          <DialogTitle sx={{ fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={20} /> PERINGATAN KERAS
          </DialogTitle>
          <DialogContent>
            <Box sx={{ p: 2, borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: '#dc2626', fontWeight: 700, mb: 1 }}>Tindakan ini akan:</Typography>
              <Typography component="ul" sx={{ fontSize: 13, color: '#7f1d1d', pl: 2, '& li': { mb: 0.5 } }}>
                <li>Menghapus SEMUA transaksi penjualan offline & interior (produksi)</li>
                <li>Menghapus semua Surat Jalan, Invoice, Proforma, SP, dan Pembayaran terkait</li>
                <li>Mereset semua counter nomor dokumen ke 0</li>
                <li>Tindakan ini <strong>TIDAK BISA DIBATALKAN</strong></li>
              </Typography>
            </Box>
            <DialogContentText sx={{ fontSize: 13 }}>Data testing (is_test=1) tidak terpengaruh.</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteAllStep(0)} size="small">Batal</Button>
            <Button variant="contained" color="error" size="small" onClick={() => setDeleteAllStep(2)}>
              Saya Mengerti, Lanjutkan
            </Button>
          </DialogActions>
        </>}

        {deleteAllStep === 2 && <>
          <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>Konfirmasi Teks</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ fontSize: 13, mb: 2 }}>
              Ketik <strong style={{ color: '#dc2626' }}>HAPUS SEMUA DATA</strong> untuk melanjutkan:
            </DialogContentText>
            <TextField fullWidth size="small" value={deleteAllTyped} onChange={e => setDeleteAllTyped(e.target.value)}
              placeholder="HAPUS SEMUA DATA" autoFocus
              sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#dc2626' } }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteAllStep(1)} size="small">Kembali</Button>
            <Button variant="contained" color="error" size="small"
              disabled={deleteAllTyped !== 'HAPUS SEMUA DATA'}
              onClick={() => setDeleteAllStep(3)}>
              Lanjutkan
            </Button>
          </DialogActions>
        </>}

        {deleteAllStep === 3 && <>
          <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>Masukkan Password</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ fontSize: 13, mb: 2 }}>
              Masukkan password akun DEV kamu untuk mengkonfirmasi penghapusan permanen ini.
            </DialogContentText>
            <TextField fullWidth size="small" type="password" value={deleteAllPass}
              onChange={e => setDeleteAllPass(e.target.value)} placeholder="Password" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && deleteAllPass && !deleteAllLoading) handleDeleteAll(); }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteAllStep(2)} disabled={deleteAllLoading} size="small">Kembali</Button>
            <Button variant="contained" color="error" size="small"
              disabled={!deleteAllPass || deleteAllLoading}
              startIcon={deleteAllLoading ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={13} />}
              onClick={handleDeleteAll}>
              {deleteAllLoading ? 'Menghapus...' : 'Hapus Sekarang'}
            </Button>
          </DialogActions>
        </>}
      </Dialog>

      {/* ── Dialog: Hapus Satu Penjualan ── */}
      <Dialog open={deleteSingle.open} onClose={() => !deleteSingleLoading && (setDeleteSingle({ open: false, sumber: 'offline', idStr: '', preview: null, step: 1 }), setDeleteSinglePass(''))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={18} /> Hapus Satu Data Penjualan
        </DialogTitle>
        <DialogContent>
          {deleteSingle.step === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                <Typography sx={{ fontSize: 12, color: '#92400e' }}>
                  ⚠ Nomor dokumen berikutnya akan <strong>otomatis disesuaikan</strong> setelah penghapusan.
                  Tindakan ini tidak bisa dibatalkan.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField select size="small" label="Tipe" value={deleteSingle.sumber}
                  onChange={e => setDeleteSingle(p => ({ ...p, sumber: e.target.value as 'offline'|'interior' }))}
                  sx={{ minWidth: 130 }} slotProps={{ select: { native: true } }}>
                  <option value="offline">Offline / Display</option>
                  <option value="interior">Interior</option>
                </TextField>
                <TextField size="small" label="ID atau Nomor Dokumen" value={deleteSingle.idStr}
                  onChange={e => setDeleteSingle(p => ({ ...p, idStr: e.target.value, preview: null, step: 1 }))}
                  placeholder="42  atau  0004/SJ/05/2025" sx={{ flex: 1 }} />
                <Button variant="outlined" size="small" onClick={handleFetchPreview}
                  disabled={!deleteSingle.idStr.trim()} sx={{ borderRadius: '8px', whiteSpace: 'nowrap' }}>
                  Cari
                </Button>
              </Box>
            </Box>
          )}
          {deleteSingle.step === 2 && deleteSingle.preview && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1, color: '#0f172a' }}>Data yang akan dihapus:</Typography>
                <Typography sx={{ fontSize: 12, color: '#475569' }}>
                  <strong>#{deleteSingle.preview.id}</strong> — {deleteSingle.preview.nama_customer || deleteSingle.preview.nama_penerima || '-'}
                  {deleteSingle.preview.no_po && ` | PO: ${deleteSingle.preview.no_po}`}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.5 }}>
                  {deleteSingle.preview.items?.length || 0} item •{' '}
                  {deleteSingle.preview.suratJalans?.length || 0} SJ •{' '}
                  {deleteSingle.preview.invoices?.length || deleteSingle.preview.suratJalanInteriors?.length || 0} Invoice
                </Typography>
              </Box>
              <TextField fullWidth size="small" type="password" label="Password DEV" value={deleteSinglePass}
                onChange={e => setDeleteSinglePass(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && deleteSinglePass && !deleteSingleLoading) handleDeleteSingle(); }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDeleteSingle({ open: false, sumber: 'offline', idStr: '', preview: null, step: 1 }); setDeleteSinglePass(''); }} disabled={deleteSingleLoading} size="small">Batal</Button>
          {deleteSingle.step === 2 && (
            <Button variant="contained" color="error" size="small"
              disabled={!deleteSinglePass || deleteSingleLoading}
              startIcon={deleteSingleLoading ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={13} />}
              onClick={handleDeleteSingle}>
              {deleteSingleLoading ? 'Menghapus...' : 'Hapus Permanen'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => !resetting && setConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Konfirmasi Hapus Data Testing</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Semua transaksi penjualan dengan flag <strong>is_test=1</strong> akan dihapus permanen,
            termasuk Surat Jalan, Invoice, Proforma, Pembayaran, dan Surat Pengantar terkait.
            Tindakan ini <strong>tidak bisa dibatalkan</strong>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={resetting} size="small">Batal</Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={13} />}
            onClick={handleResetTestData}
            sx={{ borderRadius: '8px' }}
          >
            {resetting ? 'Menghapus...' : 'Ya, Hapus Sekarang'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
