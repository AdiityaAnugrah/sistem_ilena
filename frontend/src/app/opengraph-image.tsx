import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sistem Ilena — Manajemen Penjualan ILENA Furniture';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0c1220',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(250,47,47,0.18) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(250,47,47,0.10) 0%, transparent 50%)',
          display: 'flex',
        }} />

        {/* Top: Logo placeholder + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(250,47,47,0.4)',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: '-1px' }}>IL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: '0.05em' }}>ILENA FURNITURE</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 2 }}>sistem.ilenafurniture.com</span>
          </div>
        </div>

        {/* Center: Main text */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(250,47,47,0.12)',
            border: '1px solid rgba(250,47,47,0.25)',
            borderRadius: 100,
            padding: '8px 20px',
            width: 'fit-content',
            marginBottom: 28,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FA2F2F', display: 'flex' }} />
            <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Sistem Manajemen
            </span>
          </div>

          <span style={{
            fontSize: 72, fontWeight: 900, color: 'rgba(255,255,255,0.95)',
            letterSpacing: '-2px', lineHeight: 1.05,
          }}>
            Sistem Ilena
          </span>
          <span style={{
            fontSize: 24, color: 'rgba(255,255,255,0.38)',
            marginTop: 16, lineHeight: 1.5, maxWidth: 680,
          }}>
            Penjualan, stok, dan laporan dalam satu platform terintegrasi untuk CV. Catur Bhakti Mandiri.
          </span>
        </div>

        {/* Bottom: Features */}
        <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
          {['Penjualan Offline & Interior', 'Surat Jalan & Invoice', 'Master Barang'].map((f) => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 18px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FA2F2F', display: 'flex' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
