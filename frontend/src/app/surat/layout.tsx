import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Semua Surat — ILENA',
};

export default function SuratLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .surat-header { padding: 0 20px; }
        .surat-main { max-width: 900px; margin: 0 auto; padding: 24px 20px; }
        @media (min-width: 640px) {
          .surat-header { padding: 0 28px; }
          .surat-main { padding: 32px 24px; }
        }
        .surat-invoice-row {
          flex-wrap: nowrap;
          align-items: center;
        }
        @media (max-width: 480px) {
          .surat-invoice-row { flex-wrap: wrap; }
          .surat-invoice-chip { order: -1; margin-left: auto; }
          .surat-invoice-arrow { display: none; }
        }
      `}</style>
      <header
        className="surat-header"
        style={{
          backgroundColor: '#0f172a',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>IL</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>ILENA</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            / Semua Surat
          </span>
        </div>
        <a
          href="/login"
          style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none', padding: '7px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0, marginLeft: 12,
            whiteSpace: 'nowrap',
          }}
        >
          Masuk
        </a>
      </header>
      <main className="surat-main">
        {children}
      </main>
    </div>
  );
}
