'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import {
  Box, Typography, Paper, TextField, Button,
  Switch, FormControlLabel, Divider, CircularProgress,
} from '@mui/material';
import { Video, Save } from 'lucide-react';
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
          <Typography fontWeight={700} fontSize={14}>{label}</Typography>
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
          label={<Typography fontSize={12} color="text.secondary">{form.active ? 'Aktif' : 'Nonaktif'}</Typography>}
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

  if (user?.role !== 'DEV') {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography fontSize={14}>Halaman ini hanya bisa diakses oleh DEV.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>Pengaturan</Typography>
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

      {previewData && (
        <TutorialVideoModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          youtubeUrl={previewData.url}
          startSecond={previewData.start}
          endSecond={previewData.end ?? undefined}
        />
      )}
    </Box>
  );
}
