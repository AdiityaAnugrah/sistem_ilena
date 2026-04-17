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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logoilena.svg" alt="ILENA" style={{ height: 16, width: 'auto', flexShrink: 0 }} />
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
