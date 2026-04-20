'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, IconButton, Slider, Tooltip } from '@mui/material';
import { X, Play, Pause, Maximize, Gauge } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  youtubeUrl: string;
  startSecond?: number;
  endSecond?: number;
}

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
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export default function TutorialVideoModal({
  open, onClose, youtubeUrl, startSecond = 0, endSecond,
}: Props) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeId = 'yt-tutorial-player';
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(startSecond);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoId = extractVideoId(youtubeUrl);
  const duration = endSecond && endSecond > startSecond ? endSecond - startSecond : null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const stopTracking = useCallback(() => {
    if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
  }, []);

  const startTracking = useCallback(() => {
    stopTracking();
    progressInterval.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const ct: number = playerRef.current.getCurrentTime?.() ?? startSecond;
        setCurrentTime(ct);
        if (duration) {
          const elapsed = Math.max(0, ct - startSecond);
          setProgress(Math.min(100, (elapsed / duration) * 100));
        }
        if (endSecond && ct >= endSecond) {
          playerRef.current.seekTo(startSecond, true);
          playerRef.current.pauseVideo();
          setPlaying(false);
          setProgress(0);
          setCurrentTime(startSecond);
          stopTracking();
        }
      } catch { /* player belum siap */ }
    }, 500);
  }, [startSecond, endSecond, duration, stopTracking]);

  const initPlayer = useCallback(() => {
    if (!videoId || !window.YT?.Player) return;
    try { playerRef.current?.destroy(); } catch { /* ignore */ }

    playerRef.current = new window.YT.Player(iframeId, {
      videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        start: startSecond,
        ...(endSecond ? { end: endSecond } : {}),
        playsinline: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: (e: any) => { e.target.setPlaybackRate(speed); },
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
            startTracking();
          } else {
            setPlaying(false);
            stopTracking();
          }
          if (e.data === window.YT.PlayerState.ENDED) {
            e.target.seekTo(startSecond, true);
            e.target.pauseVideo();
            setProgress(0);
            setCurrentTime(startSecond);
          }
        },
      },
    });
  }, [videoId, startSecond, endSecond, speed, startTracking, stopTracking]);

  // Load YouTube IFrame API sekali
  useEffect(() => {
    if (typeof window === 'undefined' || window.YT) return;
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
    const t = setTimeout(tryInit, 300);
    return () => clearTimeout(t);
  }, [open, videoId, initPlayer]);

  useEffect(() => {
    if (!open) {
      stopTracking();
      try { playerRef.current?.stopVideo?.(); } catch { /* ignore */ }
      setPlaying(false);
      setProgress(0);
      setCurrentTime(startSecond);
      setShowSpeedMenu(false);
    }
  }, [open, stopTracking, startSecond]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
  };

  const handleSpeed = (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    try { playerRef.current?.setPlaybackRate(s); } catch { /* ignore */ }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    document.fullscreenElement
      ? document.exitFullscreen()
      : containerRef.current.requestFullscreen?.();
  };

  if (!videoId) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '14px', overflow: 'hidden', bgcolor: '#0f172a', mx: { xs: 1.5, sm: 3 } } } }}
    >
      <DialogContent sx={{ p: 0, bgcolor: '#0f172a' }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute', top: 8, right: 8, zIndex: 20,
            bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
          }}
        >
          <X size={15} />
        </IconButton>

        {/* Video wrapper */}
        <div ref={containerRef} style={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
          {/* Placeholder untuk YouTube IFrame API */}
          <div id={iframeId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

          {/* Overlay — mencegah klik ke YouTube UI */}
          <div
            onClick={handlePlayPause}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              zIndex: 10, cursor: 'pointer',
            }}
          />

          {/* Play indicator saat paused */}
          {!playing && (
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                zIndex: 11, pointerEvents: 'none',
                width: 52, height: 52, borderRadius: '50%',
                backgroundColor: 'rgba(250,47,47,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Play size={22} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          )}
        </div>

        {/* Custom controls */}
        <div style={{
          backgroundColor: '#0f172a', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Play/Pause */}
          <IconButton onClick={handlePlayPause} size="small" sx={{ color: '#fff', p: 0.5, flexShrink: 0 }}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </IconButton>

          {/* Progress bar */}
          <Slider
            value={progress}
            size="small"
            sx={{
              flex: 1, color: '#FA2F2F', p: 0, height: 4,
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

          {/* Waktu */}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 52 }}>
            {formatTime(Math.max(0, currentTime - startSecond))}
            {duration ? ` / ${formatTime(duration)}` : ''}
          </span>

          {/* Speed */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Tooltip title="Kecepatan">
              <IconButton
                size="small"
                onClick={() => setShowSpeedMenu(p => !p)}
                sx={{ color: '#fff', p: 0.5, display: 'flex', gap: 0.3 }}
              >
                <Gauge size={14} />
                <span style={{ fontSize: 10, fontWeight: 700 }}>{speed}x</span>
              </IconButton>
            </Tooltip>
            {showSpeedMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', right: 0,
                backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 50, minWidth: 68,
              }}>
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSpeed(s)}
                    style={{
                      display: 'block', width: '100%', padding: '7px 0',
                      border: 'none', cursor: 'pointer', textAlign: 'center',
                      backgroundColor: speed === s ? 'rgba(250,47,47,0.2)' : 'transparent',
                      color: speed === s ? '#FA2F2F' : 'rgba(255,255,255,0.75)',
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
            <IconButton size="small" onClick={handleFullscreen} sx={{ color: '#fff', p: 0.5, flexShrink: 0 }}>
              <Maximize size={14} />
            </IconButton>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
