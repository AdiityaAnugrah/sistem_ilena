'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import {
  Box, Typography, Paper, TextField, Button,
  Switch, FormControlLabel, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { Video, Save, Trash2, AlertTriangle, ShieldAlert, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import TutorialVideoModal from '@/components/TutorialVideoModal';

interface TutorialConfig {
  youtube_url: string;
  start_second: number;
  end_second: number | null;
  active: boolean;
}

const EMPTY: TutorialConfig = { youtube_url: '', start_second: 0, end_second: null, active: true };

const surfaceSx = {
  borderRadius: '22px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 32px rgba(15,23,42,0.04)',
  background: '#fff',
};

function SectionTitle({
  icon,
  title,
  desc,
  badge,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  badge?: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: '14px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
          {desc && (
            <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.35, lineHeight: 1.55 }}>
              {desc}
            </Typography>
          )}
        </Box>
      </Box>
      {badge && (
        <Box sx={{
          px: 1.4, py: 0.55, borderRadius: '999px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          color: '#475569', fontSize: 11, fontWeight: 800,
          whiteSpace: 'nowrap',
        }}>
          {badge}
        </Box>
      )}
    </Box>
  );
}

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
      <Paper variant="outlined" sx={{ ...surfaceSx, p: 3, minHeight: 230, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={24} sx={{ color: '#FA2F2F' }} />
          <Typography sx={{ mt: 1.5, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Memuat video...</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        ...surfaceSx,
        p: { xs: 2.2, sm: 3 },
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 18px 38px rgba(15,23,42,0.07)', borderColor: '#cbd5e1' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '13px', background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={17} color="#FA2F2F" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>{label}</Typography>
            <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.2 }}>Video bantuan yang tampil di form transaksi</Typography>
          </Box>
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
        fullWidth label="URL YouTube" size="small" sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        placeholder="https://www.youtube.com/watch?v=..."
        value={form.youtube_url}
        onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
        <TextField
          label="Mulai dari" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          placeholder="0:00"
          value={startStr}
          onChange={e => setStartStr(e.target.value)}
          helperText="Format mm:ss  (contoh: 1:30)"
        />
        <TextField
          label="Sampai" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          placeholder="Opsional"
          value={endStr}
          onChange={e => setEndStr(e.target.value)}
          helperText="Kosongkan = sampai akhir"
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button
          variant="outlined" size="small" sx={{ borderRadius: '12px', minHeight: 36, px: 2, fontWeight: 800, borderColor: '#cbd5e1', color: '#475569' }}
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
          sx={{ borderRadius: '12px', minHeight: 36, px: 2, fontWeight: 800, bgcolor: '#FA2F2F', boxShadow: '0 10px 20px rgba(250,47,47,.18)', '&:hover': { bgcolor: '#d41a1a' } }}
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

  // App settings
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});
  const [appSettingsLoading, setAppSettingsLoading] = useState(true);

  useEffect(() => {
    api.get('/settings/app')
      .then(r => setAppSettings(r.data || {}))
      .catch(() => {})
      .finally(() => setAppSettingsLoading(false));
  }, []);

  const toggleAppSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setAppSettings(prev => ({ ...prev, [key]: newValue }));
    try {
      await api.put('/settings/app', { key, value: newValue });
      toast.success('Pengaturan berhasil disimpan');
    } catch (err: any) {
      setAppSettings(prev => ({ ...prev, [key]: currentValue }));
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    }
  };

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
    <Box sx={{ maxWidth: 1120, mx: 'auto', p: { xs: 1, sm: 2, lg: 0 } }}>
      {/* ═══ Page Header ═══ */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: '28px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 56%, #312e81 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 22px 48px rgba(15,23,42,.14)',
        }}
      >
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.08,
          backgroundImage: 'radial-gradient(circle at 24px 24px, #fff 2px, transparent 0)',
          backgroundSize: '34px 34px',
        }} />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.7 }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: '16px',
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Settings2 size={22} color="#fff" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, sm: 30 }, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              Pengaturan
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#cbd5e1', mt: 0.7 }}>
              Kelola konfigurasi sistem, tutorial, dan data development dengan kontrol yang aman.
            </Typography>
          </Box>
          </Box>
          <Box sx={{
            px: 1.6, py: 0.8, borderRadius: '999px',
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)',
            fontSize: 11.5, fontWeight: 900, color: '#fde68a', letterSpacing: '.04em',
          }}>
            DEV ONLY
          </Box>
        </Box>
      </Box>

      {/* ═══ Section 1: Tutorial Video ═══ */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle
          icon={<Video size={18} color="#FA2F2F" />}
          title="Tutorial Video"
          desc="Atur video bantuan yang muncul di alur input penjualan."
          badge="2 video"
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5 }}>
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
      </Box>

      {/* ═══ Section 2: Pengaturan Penjualan ═══ */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle
          icon={<Settings2 size={18} color="#6366f1" />}
          title="Pengaturan Penjualan"
          desc="Konfigurasi perilaku otomatis pada transaksi dan dokumen."
        />
        <Paper
          variant="outlined"
          sx={{
            ...surfaceSx,
            overflow: 'hidden',
            transition: 'box-shadow 0.2s',
            '&:hover': { boxShadow: '0 18px 38px rgba(99,102,241,0.08)' },
          }}
        >
          <Box sx={{
            display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', gap: 2,
            p: 2.5,
          }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Lock Jenis Dokumen Mengikuti Penjualan Sebelumnya
                </Typography>
                <Box sx={{
                  px: 1, py: 0.15, borderRadius: '6px', flexShrink: 0,
                  background: (appSettings.lock_jenis_dokumen_display ?? 'true') === 'true' ? '#eef2ff' : '#f1f5f9',
                  border: (appSettings.lock_jenis_dokumen_display ?? 'true') === 'true' ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                }}>
                  <Typography sx={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    color: (appSettings.lock_jenis_dokumen_display ?? 'true') === 'true' ? '#4f46e5' : '#94a3b8',
                  }}>
                    {(appSettings.lock_jenis_dokumen_display ?? 'true') === 'true' ? 'AKTIF' : 'NONAKTIF'}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
                Jika aktif, jenis dokumen (Faktur / Non-Faktur) pada Proses Penjualan Display
                akan otomatis terkunci mengikuti penjualan sebelumnya dari display yang sama.
              </Typography>
            </Box>
            <Switch
              checked={(appSettings.lock_jenis_dokumen_display ?? 'true') === 'true'}
              onChange={() => toggleAppSetting('lock_jenis_dokumen_display', appSettings.lock_jenis_dokumen_display ?? 'true')}
              size="small"
              disabled={appSettingsLoading}
              sx={{
                flexShrink: 0,
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366f1' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#6366f1' },
              }}
            />
          </Box>
        </Paper>
      </Box>

      {/* ═══ Section 3: Manajemen Data ═══ */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle
          icon={<Trash2 size={18} color="#f59e0b" />}
          title="Manajemen Data Testing"
          desc="Bersihkan data simulasi tanpa menyentuh data produksi."
          badge="Aman untuk test"
        />
        <Paper
          variant="outlined"
          sx={{
            ...surfaceSx,
            p: { xs: 2.2, sm: 2.8 },
            transition: 'box-shadow 0.2s',
            '&:hover': { boxShadow: '0 18px 38px rgba(245,158,11,0.08)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
              background: '#fffbeb', border: '1px solid #fde68a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={14} color="#f59e0b" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1e293b', mb: 0.3 }}>
                Reset Data Testing
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
                Hapus semua transaksi penjualan (offline & interior) yang dibuat dalam mode testing
                (is_test=1), termasuk Surat Jalan, Invoice, Proforma, dan Pembayaran.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            color="warning"
            size="small"
            startIcon={<Trash2 size={13} />}
            onClick={() => setConfirmOpen(true)}
            sx={{ borderRadius: '8px', ml: 5.5, fontWeight: 600 }}
          >
            Hapus Semua Data Testing
          </Button>
        </Paper>
      </Box>

      {/* ═══ Section 4: Danger Zone ═══ */}
      <Box sx={{ mb: 2 }}>
        <SectionTitle
          icon={<ShieldAlert size={18} color="#dc2626" />}
          title="Danger Zone"
          desc="Area khusus tindakan permanen. Semua aksi memakai konfirmasi bertahap."
          badge="HATI-HATI"
        />
        <Box sx={{
          border: '1px solid #fecaca', borderRadius: '24px', overflow: 'hidden',
          boxShadow: '0 18px 42px rgba(220,38,38,.08)',
          background: '#fff',
        }}>
          {/* Header */}
          <Box sx={{
            background: 'linear-gradient(135deg, #991b1b, #dc2626)',
            px: 3, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <ShieldAlert size={16} color="#fff" />
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff', letterSpacing: '0.04em' }}>
              Operasi Tidak Bisa Dibatalkan
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            {/* Card 1: Hapus semua produksi */}
            <Paper variant="outlined" sx={{
              p: 2.5, borderRadius: '18px', borderColor: '#fca5a5', background: '#fff5f5',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 12px 28px rgba(220,38,38,0.12)' },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '7px', flexShrink: 0,
                  background: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={14} color="#dc2626" />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: '#dc2626' }}>
                    Hapus Semua Data Penjualan Produksi
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.5, lineHeight: 1.5 }}>
                    Menghapus <strong>seluruh</strong> transaksi offline & interior (is_test=0)
                    beserta semua dokumen terkait dan mereset counter nomor dokumen ke 0.
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" size="small" color="error"
                startIcon={<Trash2 size={12} />}
                onClick={() => setDeleteAllStep(1)}
                sx={{ borderRadius: '8px', ml: 5, fontWeight: 600, fontSize: 11.5 }}>
                Hapus Semua Data Produksi
              </Button>
            </Paper>

            {/* Card 2: Hapus per penjualan */}
            <Paper variant="outlined" sx={{
              p: 2.5, borderRadius: '18px', borderColor: '#fcd34d', background: '#fffbeb',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 12px 28px rgba(217,119,6,0.12)' },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '7px', flexShrink: 0,
                  background: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={14} color="#d97706" />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: '#d97706' }}>
                    Hapus Satu Data Penjualan
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.5, lineHeight: 1.5 }}>
                    Hapus satu transaksi beserta dokumennya. Nomor dokumen berikutnya akan
                    otomatis disesuaikan agar tidak ada celah urutan.
                  </Typography>
                </Box>
              </Box>
              <Button variant="outlined" size="small" color="warning"
                startIcon={<Trash2 size={12} />}
                onClick={() => setDeleteSingle(p => ({ ...p, open: true }))}
                sx={{ borderRadius: '8px', ml: 5, fontWeight: 600, fontSize: 11.5 }}>
                Pilih & Hapus Satu Penjualan
              </Button>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* ═══ Modals / Dialogs ═══ */}
      {previewData && (
        <TutorialVideoModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          youtubeUrl={previewData.url}
          startSecond={previewData.start}
          endSecond={previewData.end ?? undefined}
        />
      )}

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
