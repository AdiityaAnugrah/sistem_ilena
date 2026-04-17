import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Semua Surat — ILENA',
};

export default function SuratLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <header style={{
        backgroundColor: '#0f172a',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>IL</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 14 }}>ILENA</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginLeft: 4 }}>/ Semua Surat</span>
        </div>
        <a
          href="/login"
          style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none', padding: '6px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          Masuk
        </a>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        {children}
      </main>
    </div>
  );
}
