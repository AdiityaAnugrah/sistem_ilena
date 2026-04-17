# Video Tutorial per Form Penjualan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tombol tutorial di form Penjualan Offline & Interior yang memutar video YouTube dengan custom player (tanpa kontrol YouTube asli, speed control, fullscreen). Link & durasi dikonfigurasi dari halaman Pengaturan khusus DEV.

**Architecture:** Backend: model + route upsert per form_type. Frontend: halaman Pengaturan (DEV), komponen TutorialVideoModal, tombol di dua form.

**Tech Stack:** Next.js App Router, Express.js, Sequelize, MUI v6, YouTube IFrame API

---

## File Structure

**Backend (baru):**
- `backend/src/models/TutorialVideo.js` — model tabel `tutorial_videos`
- `backend/src/routes/tutorialVideo.js` — GET publik + PUT DEV-only

**Backend (modifikasi):**
- `backend/src/models/index.js` — require TutorialVideo
- `backend/src/app.js` — daftarkan route

**Frontend (baru):**
- `frontend/src/app/dashboard/pengaturan/page.tsx` — halaman Pengaturan (DEV only)
- `frontend/src/components/TutorialVideoModal.tsx` — custom YouTube player modal

**Frontend (modifikasi):**
- `frontend/src/components/layout/Sidebar.tsx` — tambah link Pengaturan (devOnly)
- `frontend/src/app/dashboard/penjualan/offline/baru/page.tsx` — tambah tombol tutorial
- `frontend/src/app/dashboard/penjualan/interior/baru/page.tsx` — tambah tombol tutorial

---

## Task 1: Backend — Model & Route Tutorial Video

**Files:**
- Create: `backend/src/models/TutorialVideo.js`
- Create: `backend/src/routes/tutorialVideo.js`
- Modify: `backend/src/models/index.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Buat model**

```js
// backend/src/models/TutorialVideo.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TutorialVideo = sequelize.define('tutorial_videos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_type: {
    type: DataTypes.ENUM('PENJUALAN_OFFLINE', 'PENJUALAN_INTERIOR'),
    allowNull: false,
    unique: true,
  },
  youtube_url: { type: DataTypes.STRING(255), allowNull: false },
  start_second: { type: DataTypes.INTEGER, defaultValue: 0 },
  end_second: { type: DataTypes.INTEGER, defaultValue: null },
  active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
  updated_by: { type: DataTypes.INTEGER, defaultValue: null },
}, { timestamps: false });

module.exports = TutorialVideo;
```

- [ ] **Step 2: Buat route**

```js
// backend/src/routes/tutorialVideo.js
const express = require('express');
const TutorialVideo = require('../models/TutorialVideo');
const { authenticate, requireDev } = require('../middleware/auth');

const router = express.Router();

// GET /api/tutorial-video — semua record (publik, tidak butuh auth)
router.get('/', async (req, res) => {
  try {
    const rows = await TutorialVideo.findAll();
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/tutorial-video/:form_type — satu record
router.get('/:form_type', async (req, res) => {
  try {
    const row = await TutorialVideo.findOne({ where: { form_type: req.params.form_type } });
    if (!row) return res.status(404).json({ message: 'Tidak ditemukan' });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/tutorial-video/:form_type — upsert, DEV only
router.put('/:form_type', authenticate, requireDev, async (req, res) => {
  try {
    const { youtube_url, start_second, end_second, active } = req.body;
    const form_type = req.params.form_type;

    if (!['PENJUALAN_OFFLINE', 'PENJUALAN_INTERIOR'].includes(form_type)) {
      return res.status(400).json({ message: 'form_type tidak valid' });
    }

    const [row, created] = await TutorialVideo.findOrCreate({
      where: { form_type },
      defaults: { youtube_url, start_second: start_second || 0, end_second: end_second || null, active: 1, updated_by: req.user.id },
    });

    if (!created) {
      await row.update({
        youtube_url,
        start_second: start_second || 0,
        end_second: end_second || null,
        active: active !== undefined ? active : row.active,
        updated_by: req.user.id,
      });
    }

    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Daftarkan di models/index.js**

Tambahkan setelah require yang sudah ada:
```js
const TutorialVideo = require('./TutorialVideo');
```

Dan di bagian exports (paling bawah object exports):
```js
TutorialVideo,
```

- [ ] **Step 4: Daftarkan di app.js**

Tambahkan setelah route log-activity:
```js
app.use('/api/tutorial-video', require('./routes/tutorialVideo'));
```

- [ ] **Step 5: Test**

```bash
curl http://localhost:5000/api/tutorial-video
```
Expected: `[]` (array kosong karena belum ada data)

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/TutorialVideo.js backend/src/routes/tutorialVideo.js backend/src/models/index.js backend/src/app.js
git commit -m "feat: model & route tutorial_videos (GET publik, PUT DEV only)"
```

---

## Task 2: Frontend — Komponen TutorialVideoModal

**Files:**
- Create: `frontend/src/components/TutorialVideoModal.tsx`

Komponen ini menggunakan YouTube IFrame API dengan `controls=0` dan custom controls MUI. Iframe tidak bisa diklik (pointer-events: none), overlay transparan menangkap klik untuk play/pause. Tidak ada link ke YouTube.

- [ ] **Step 1: Buat komponen**

```tsx
// frontend/src/components/TutorialVideoModal.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, IconButton, Slider, Tooltip,
} from '@mui/material';
import { X, Play, Pause, Maximize, Gauge } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  youtubeUrl: string;
  startSecond?: number;
  endSecond?: number;
}

// Ekstrak YouTube video ID dari berbagai format URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function TutorialVideoModal({ open, onClose, youtubeUrl, startSecond = 0, endSecond }: Props) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeId = 'yt-tutorial-player';
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [currentTime, setCurrentTime] = useState(startSecond);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const videoId = extractVideoId(youtubeUrl);

  const duration = endSecond && endSecond > startSecond ? endSecond - startSecond : null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const ct = playerRef.current.getCurrentTime?.() ?? startSecond;
        setCurrentTime(ct);
        if (duration) {
          const elapsed = Math.max(0, ct - startSecond);
          setProgress(Math.min(100, (elapsed / duration) * 100));
        }
        // Auto-stop at end_second
        if (endSecond && ct >= endSecond) {
          playerRef.current.seekTo(startSecond, true);
          playerRef.current.pauseVideo();
          setPlaying(false);
          setProgress(0);
          setCurrentTime(startSecond);
        }
      } catch { /* player belum siap */ }
    }, 500);
  }, [startSecond, endSecond, duration]);

  const stopProgressTracking = useCallback(() => {
    if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
  }, []);

  const initPlayer = useCallback(() => {
    if (!videoId || !window.YT?.Player) return;
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ignore */ }
    }
    playerRef.current = new window.YT.Player(iframeId, {
      videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        disablekb: 1,
        start: startSecond,
        ...(endSecond ? { end: endSecond } : {}),
        playsinline: 1,
        fs: 0, // disable YT native fullscreen button (kita pakai custom)
      },
      events: {
        onReady: (e: any) => { e.target.setPlaybackRate(speed); },
        onStateChange: (e: any) => {
          const state = e.data;
          if (state === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
            startProgressTracking();
          } else {
            setPlaying(false);
            stopProgressTracking();
          }
          // Loop kembali ke start jika video ended
          if (state === window.YT.PlayerState.ENDED) {
            e.target.seekTo(startSecond, true);
            e.target.pauseVideo();
            setProgress(0);
            setCurrentTime(startSecond);
          }
        },
      },
    });
  }, [videoId, startSecond, endSecond, speed, startProgressTracking, stopProgressTracking]);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  useEffect(() => {
    if (!open || !videoId) return;
    const tryInit = () => {
      if (window.YT?.Player) { initPlayer(); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer(); };
    };
    // Delay agar Dialog sudah mount dan div placeholder sudah ada
    const t = setTimeout(tryInit, 300);
    return () => clearTimeout(t);
  }, [open, videoId, initPlayer]);

  useEffect(() => {
    if (!open) {
      stopProgressTracking();
      try { playerRef.current?.stopVideo?.(); } catch { /* ignore */ }
      setPlaying(false);
      setProgress(0);
      setCurrentTime(startSecond);
    }
  }, [open, stopProgressTracking, startSecond]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (playing) { playerRef.current.pauseVideo(); }
    else { playerRef.current.playVideo(); }
  };

  const handleSpeed = (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    try { playerRef.current?.setPlaybackRate(s); } catch { /* ignore */ }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  };

  if (!videoId) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '14px', overflow: 'hidden', bgcolor: '#0f172a' } } }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', bgcolor: '#0f172a' }}>
        {/* Close button */}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 20, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
        >
          <X size={16} />
        </IconButton>

        {/* Video container */}
        <div ref={containerRef} style={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
          {/* YouTube iframe placeholder */}
          <div
            id={iframeId}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
          {/* Overlay: cegah klik ke YouTube UI, tangkap play/pause */}
          <div
            onClick={handlePlayPause}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              zIndex: 10, cursor: 'pointer',
              background: 'transparent',
            }}
          />
          {/* Play indicator saat paused */}
          {!playing && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              zIndex: 11, pointerEvents: 'none',
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: 'rgba(250,47,47,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          )}
        </div>

        {/* Custom controls bar */}
        <div style={{
          backgroundColor: '#0f172a', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Play/Pause */}
          <IconButton onClick={handlePlayPause} size="small" sx={{ color: '#fff', p: 0.5 }}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </IconButton>

          {/* Progress bar */}
          <div style={{ flex: 1 }}>
            <Slider
              value={progress}
              size="small"
              sx={{
                color: '#FA2F2F', p: 0, height: 4,
                '& .MuiSlider-thumb': { width: 12, height: 12 },
              }}
              onChange={(_, v) => {
                if (!playerRef.current || !duration) return;
                const target = startSecond + ((v as number) / 100) * duration;
                playerRef.current.seekTo(target, true);
                setProgress(v as number);
                setCurrentTime(target);
              }}
            />
          </div>

          {/* Time */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', minWidth: 60 }}>
            {formatTime(Math.max(0, currentTime - startSecond))}
            {duration ? ` / ${formatTime(duration)}` : ''}
          </span>

          {/* Speed selector */}
          <div style={{ position: 'relative' }}>
            <Tooltip title="Kecepatan">
              <IconButton
                size="small"
                onClick={() => setShowSpeedMenu(p => !p)}
                sx={{ color: '#fff', fontSize: 11, p: 0.5, gap: 0.5 }}
              >
                <Gauge size={15} />
                <span style={{ fontSize: 10, fontWeight: 700 }}>{speed}x</span>
              </IconButton>
            </Tooltip>
            {showSpeedMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', right: 0,
                backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 50, minWidth: 70,
              }}>
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSpeed(s)}
                    style={{
                      display: 'block', width: '100%', padding: '7px 14px',
                      border: 'none', cursor: 'pointer', textAlign: 'center',
                      backgroundColor: speed === s ? 'rgba(250,47,47,0.2)' : 'transparent',
                      color: speed === s ? '#FA2F2F' : 'rgba(255,255,255,0.8)',
                      fontWeight: speed === s ? 700 : 400, fontSize: 12,
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <Tooltip title="Layar penuh">
            <IconButton size="small" onClick={handleFullscreen} sx={{ color: '#fff', p: 0.5 }}>
              <Maximize size={15} />
            </IconButton>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TutorialVideoModal.tsx
git commit -m "feat: komponen TutorialVideoModal — YouTube embed custom player tanpa kontrol asli"
```

---

## Task 3: Frontend — Halaman Pengaturan (DEV only)

**Files:**
- Create: `frontend/src/app/dashboard/pengaturan/page.tsx`

- [ ] **Step 1: Buat halaman pengaturan**

```tsx
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

// Konversi mm:ss → detik
function mmssToSec(v: string): number {
  const parts = v.split(':').map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return Number(v) || 0;
}

// Konversi detik → mm:ss
function secToMmss(s: number | null | undefined): string {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function VideoCard({
  label, formType, onPreview,
}: { label: string; formType: string; onPreview: (url: string, start: number, end: number | null) => void }) {
  const [form, setForm] = useState<TutorialConfig>(EMPTY);
  const [startStr, setStartStr] = useState('0:00');
  const [endStr, setEndStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tutorial-video/${formType}`)
      .then(r => {
        setForm({ ...r.data, active: !!r.data.active });
        setStartStr(secToMmss(r.data.start_second));
        setEndStr(secToMmss(r.data.end_second));
      })
      .catch(() => {/* belum ada, pakai EMPTY */})
      .finally(() => setLoading(false));
  }, [formType]);

  const handleSave = async () => {
    if (!form.youtube_url.trim()) { toast.error('URL YouTube wajib diisi'); return; }
    setSaving(true);
    try {
      const start = mmssToSec(startStr);
      const end = endStr.trim() ? mmssToSec(endStr) : null;
      if (end !== null && end <= start) { toast.error('Waktu selesai harus setelah waktu mulai'); setSaving(false); return; }
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

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: '14px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Video size={18} color="#FA2F2F" />
          <Typography fontWeight={700} fontSize={15}>{label}</Typography>
        </Box>
        <FormControlLabel
          control={<Switch checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} size="small" />}
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

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Mulai dari (mm:ss)" size="small" sx={{ flex: 1 }}
          placeholder="0:00"
          value={startStr}
          onChange={e => setStartStr(e.target.value)}
          helperText="Contoh: 1:30 = menit ke-1, detik ke-30"
        />
        <TextField
          label="Sampai (mm:ss)" size="small" sx={{ flex: 1 }}
          placeholder="Opsional"
          value={endStr}
          onChange={e => setEndStr(e.target.value)}
          helperText="Kosongkan = sampai akhir video"
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
          variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
          disabled={saving} onClick={handleSave}
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
        <Typography>Halaman ini hanya bisa diakses oleh DEV.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/pengaturan/page.tsx
git commit -m "feat: halaman Pengaturan dengan konfigurasi video tutorial per form (DEV only)"
```

---

## Task 4: Frontend — Sidebar + Tombol Tutorial di Form

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/dashboard/penjualan/offline/baru/page.tsx`
- Modify: `frontend/src/app/dashboard/penjualan/interior/baru/page.tsx`

- [ ] **Step 1: Tambah link Pengaturan di Sidebar**

Import `Settings` dari lucide-react:
```tsx
import { ..., Settings } from 'lucide-react';
```

Tambahkan ke NAV_ITEMS setelah Log Aktivitas:
```tsx
{ label: 'Pengaturan', href: '/dashboard/pengaturan', icon: Settings, devOnly: true },
```

- [ ] **Step 2: Tambah tombol tutorial di form Penjualan Offline**

Di `/dashboard/penjualan/offline/baru/page.tsx`, tambahkan:

1. Import komponen dan hook di bagian atas:
```tsx
import TutorialVideoModal from '@/components/TutorialVideoModal';
```

2. Tambah state di dalam komponen (setelah state yang sudah ada):
```tsx
const [tutorial, setTutorial] = useState<{ youtube_url: string; start_second: number; end_second: number | null; active: number } | null>(null);
const [tutorialOpen, setTutorialOpen] = useState(false);
```

3. Tambah useEffect fetch tutorial (setelah useEffect yang sudah ada):
```tsx
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tutorial-video/PENJUALAN_OFFLINE`)
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.active) setTutorial(d); })
    .catch(() => {});
}, []);
```

4. Tambah tombol Tutorial di header form (cari bagian judul "Penjualan Offline Baru" atau tombol Kembali, tambahkan di sebelahnya):
```tsx
{tutorial && (
  <button
    type="button"
    onClick={() => setTutorialOpen(true)}
    style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 8,
      border: '1px solid #e2e8f0', backgroundColor: '#fff',
      color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    }}
  >
    <span>🎬</span> Tutorial
  </button>
)}
{tutorial && tutorialOpen && (
  <TutorialVideoModal
    open={tutorialOpen}
    onClose={() => setTutorialOpen(false)}
    youtubeUrl={tutorial.youtube_url}
    startSecond={tutorial.start_second}
    endSecond={tutorial.end_second ?? undefined}
  />
)}
```

- [ ] **Step 3: Lakukan hal yang sama di form Penjualan Interior**

Sama persis dengan Step 2, tapi:
- `PENJUALAN_OFFLINE` → `PENJUALAN_INTERIOR`
- File: `/dashboard/penjualan/interior/baru/page.tsx`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx \
        frontend/src/app/dashboard/penjualan/offline/baru/page.tsx \
        frontend/src/app/dashboard/penjualan/interior/baru/page.tsx
git commit -m "feat: tombol tutorial di form penjualan offline & interior + link Pengaturan di sidebar"
```

---

## Task 5: Deploy & Final Check

- [ ] **Step 1: Push semua commit**
```bash
git push
```

- [ ] **Step 2: Deploy di server**
```bash
git pull && cd backend && pm2 restart all
cd ../frontend && npm run build && pm2 restart frontend
```

- [ ] **Step 3: Verifikasi sebagai DEV**
  - Buka `/dashboard/pengaturan` → isi URL YouTube + waktu mulai/selesai → Simpan
  - Klik Preview → video harus muncul dengan custom controls (tanpa kontrol YouTube asli)
  - Coba klik area video → play/pause bekerja, tidak bisa klik ke YouTube
  - Speed selector → ganti ke 1.5x → video dipercepat
  - Fullscreen → masuk fullscreen

- [ ] **Step 4: Verifikasi sebagai non-DEV**
  - Buka form Penjualan Offline Baru → tombol Tutorial muncul (jika active=true)
  - Klik Tutorial → video player terbuka
  - Buka `/dashboard/pengaturan` → tampil pesan "hanya DEV"
