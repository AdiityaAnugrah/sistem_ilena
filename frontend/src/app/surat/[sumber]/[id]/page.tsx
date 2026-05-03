'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FileText, ArrowLeft, ExternalLink, Lock, Truck, CheckCircle2, Package, CreditCard } from 'lucide-react';

interface DokumenCard {
  id: number;
  nomor: string;
  tanggal?: string;
  jatuh_tempo?: string;
  tipe: string;
  subs?: { id: number; nomor: string; tipe: string }[];
}

interface Pembayaran {
  id: number;
  tipe: string;
  jumlah: number;
  tanggal: string;
}

interface TreeData {
  penjualan: {
    id: number;
    nama_penerima?: string;
    nama_customer?: string;
    no_hp_penerima?: string;
    no_hp?: string;
    tanggal: string;
    status: string;
    tipe?: string;
    pakai_ppn?: number;
    ppn_persen?: string;
  };
  sumber: 'OFFLINE' | 'INTERIOR';
  ringkasan: {
    total_nilai?: number;
    total_qty?: number;
    jumlah_sj?: number;
    jatuh_tempo?: string;
    grand_total?: number;
    total_bayar?: number;
    sisa_tagihan?: number;
    persen_bayar?: number;
    sudah_kirim?: number;
    persen_kirim?: number;
  };
  pembayarans?: Pembayaran[];
  dokumen: {
    invoices?: DokumenCard[];
    suratJalans?: DokumenCard[];
    suratPengantars?: DokumenCard[];
    proformas?: DokumenCard[];
    subInvoices?: DokumenCard[];
  };
}

const TIPE_LABEL: Record<string, string> = {
  'invoice': 'Invoice',
  'surat-jalan': 'Surat Jalan',
  'sp': 'Surat Pengantar',
  'sp-sub': 'SP Sub',
  'proforma': 'Proforma Invoice',
  'sub-invoice': 'Sub Invoice',
  'surat-jalan-interior': 'Surat Jalan Interior',
  'invoice-interior': 'Invoice Interior',
  'sp-interior': 'Surat Pengantar Interior',
};

const TIPE_COLOR: Record<string, string> = {
  'invoice': '#15803d',
  'surat-jalan': '#2563eb',
  'sp': '#b45309',
  'sp-sub': '#c2410c',
  'proforma': '#6d28d9',
  'sub-invoice': '#86198f',
  'surat-jalan-interior': '#0369a1',
  'invoice-interior': '#15803d',
  'sp-interior': '#b45309',
};

const TIPE_BAYAR: Record<string, string> = {
  'DP': 'Uang Muka (DP)',
  'TERMIN_1': 'Termin 1',
  'TERMIN_2': 'Termin 2',
  'TERMIN_3': 'Termin 3',
  'PELUNASAN_AKHIR': 'Pelunasan Akhir',
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  'DRAFT': { label: 'Draft', color: '#92400e', bg: '#fffbeb' },
  'ACTIVE': { label: 'Aktif', color: '#1d4ed8', bg: '#eff6ff' },
  'COMPLETED': { label: 'Selesai', color: '#15803d', bg: '#f0fdf4' },
};

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

function formatRp(v: number) {
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

function formatTgl(d?: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProgressBar({ persen, color }: { persen: number; color: string }) {
  return (
    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${Math.min(100, persen)}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function TreeSuratPage() {
  const { sumber, id } = useParams<{ sumber: string; id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loginModal, setLoginModal] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/public/surat/${sumber}/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return; }
        setData(await r.json());
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [sumber, id]);

  const handleLihat = async (tipe: string, docId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { setLoginModal(true); return; }
    try {
      const res = await fetch(`${API}/api/auth/print-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoginModal(true); return; }
      const { token: printToken } = await res.json();
      const path = tipe === 'sub-invoice'
        ? `/api/dokumen/proforma/${docId}/sub-invoice/print`
        : `/api/dokumen/${tipe}/${docId}/print`;
      window.open(`${API}${path}?token=${printToken}`, '_blank');
    } catch {
      setLoginModal(true);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <CircularProgress sx={{ color: '#FA2F2F' }} />
    </div>
  );

  if (notFound || !data) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
      <FileText size={36} color="#e2e8f0" style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>Penjualan tidak ditemukan</div>
      <button onClick={() => router.push('/surat')} style={{ marginTop: 12, background: 'none', border: 'none', color: '#FA2F2F', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
        Kembali
      </button>
    </div>
  );

  const { penjualan, sumber: src, ringkasan, dokumen, pembayarans = [] } = data;
  const nama = penjualan.nama_penerima || penjualan.nama_customer || '-';
  const noHp = penjualan.no_hp_penerima || penjualan.no_hp || null;
  const status = STATUS_LABEL[penjualan.status] || STATUS_LABEL['ACTIVE'];

  const stepsOffline = [
    { label: 'Dibuat', done: true, icon: Package },
    { label: 'Invoice', done: (dokumen.invoices?.length || 0) > 0, icon: FileText },
    { label: 'Dikirim', done: (dokumen.suratJalans?.length || 0) > 0, icon: Truck },
    { label: 'Selesai', done: penjualan.status === 'COMPLETED', icon: CheckCircle2 },
  ];

  const stepsInterior = [
    { label: 'Dibuat', done: true, icon: Package },
    { label: 'Proforma', done: (dokumen.proformas?.length || 0) > 0, icon: FileText },
    { label: 'Kirim', done: (dokumen.suratJalans?.length || 0) > 0, icon: Truck },
    { label: 'Invoice', done: (dokumen.invoices?.length || 0) > 0, icon: FileText },
    { label: 'Lunas', done: (ringkasan.sisa_tagihan || 0) === 0 && (ringkasan.total_bayar || 0) > 0, icon: CheckCircle2 },
  ];

  const steps = src === 'OFFLINE' ? stepsOffline : stepsInterior;
  const lastDoneIdx = steps.reduce((acc, s, i) => s.done ? i : acc, -1);

  const allDokumen = [
    ...(dokumen.invoices || []),
    ...(dokumen.proformas || []),
    ...(dokumen.subInvoices || []),
    ...(dokumen.suratJalans || []),
    ...(dokumen.suratPengantars || []),
  ];

  const DokCard = ({ doc, indent = false }: { doc: DokumenCard; indent?: boolean }) => {
    const color = TIPE_COLOR[doc.tipe] || '#64748b';
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #e8edf3',
        borderLeft: `3px solid ${indent ? color : color}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        marginLeft: indent ? 16 : 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.nomor}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            <span style={{ fontWeight: 600, color }}>{TIPE_LABEL[doc.tipe] || doc.tipe}</span>
            {doc.tanggal ? ` · ${formatTgl(doc.tanggal)}` : ''}
            {doc.jatuh_tempo ? ` · JT: ${formatTgl(doc.jatuh_tempo)}` : ''}
          </div>
        </div>
        <button
          onClick={() => handleLihat(doc.tipe, doc.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            borderRadius: 8, border: `1px solid ${color}`, background: 'transparent',
            color, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            padding: '8px 12px', fontSize: 12, minWidth: 60, justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ExternalLink size={11} /> Lihat
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        .td-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; overflow: hidden; }
        .td-section-head { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px; }
      `}</style>

      {/* Back */}
      <button onClick={() => router.push('/surat')} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#64748b', fontSize: 13, fontWeight: 600, padding: '6px 0',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <ArrowLeft size={14} /> Semua Dokumen
      </button>

      {/* Header card */}
      <div className="td-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Penjualan {src}
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              {nama}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
              <span>📅 {formatTgl(penjualan.tanggal)}</span>
              {noHp && <span>📱 {noHp}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <Chip label={status.label} size="small" sx={{ fontWeight: 700, fontSize: 9, height: 20, backgroundColor: status.bg, color: status.color }} />
            <Chip label={src} size="small" sx={{ fontWeight: 700, fontSize: 9, height: 20, backgroundColor: src === 'OFFLINE' ? '#eff6ff' : '#f0fdf4', color: src === 'OFFLINE' ? '#2563eb' : '#15803d' }} />
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, overflowX: 'auto', paddingBottom: 2, gap: 0 }}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === lastDoneIdx + 1;
            const isDone = step.done;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none', minWidth: 'fit-content' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? '#FA2F2F' : isActive ? '#fff7ed' : '#f1f5f9',
                    border: `2px solid ${isDone ? '#FA2F2F' : isActive ? '#fdba74' : '#e2e8f0'}`,
                    flexShrink: 0,
                  }}>
                    {isDone ? <CheckCircle2 size={14} color="#fff" /> : <Icon size={13} color={isActive ? '#f97316' : '#94a3b8'} />}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: isDone || isActive ? 700 : 500, color: isDone ? '#FA2F2F' : isActive ? '#f97316' : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: step.done ? '#FA2F2F' : '#e2e8f0', margin: '0 3px', minWidth: 8, marginBottom: 14 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats INTERIOR */}
      {src === 'INTERIOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="td-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={12} color="#FA2F2F" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bayar</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{formatRp(ringkasan.total_bayar || 0)}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>dari {formatRp(ringkasan.grand_total || 0)}</div>
            <ProgressBar persen={ringkasan.persen_bayar || 0} color="#FA2F2F" />
            <div style={{ fontSize: 10, color: '#FA2F2F', fontWeight: 700, marginTop: 3 }}>{ringkasan.persen_bayar || 0}%</div>
            {(ringkasan.sisa_tagihan || 0) > 0 && (
              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                Sisa: {formatRp(ringkasan.sisa_tagihan || 0)}
              </div>
            )}
          </div>
          <div className="td-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={12} color="#16a34a" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kirim</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{ringkasan.sudah_kirim || 0} unit</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>dari {ringkasan.total_qty || 0} unit</div>
            <ProgressBar persen={ringkasan.persen_kirim || 0} color="#16a34a" />
            <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 3 }}>{ringkasan.persen_kirim || 0}%</div>
          </div>
        </div>
      )}

      {/* Stats OFFLINE */}
      {src === 'OFFLINE' && (ringkasan.total_nilai || 0) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="td-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={12} color="#FA2F2F" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{formatRp(ringkasan.total_nilai || 0)}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{ringkasan.total_qty || 0} item</div>
          </div>
          <div className="td-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={12} color="#16a34a" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kirim</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{ringkasan.jumlah_sj || 0} SJ</div>
            {ringkasan.jatuh_tempo && (
              <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600, marginTop: 2 }}>JT: {formatTgl(ringkasan.jatuh_tempo)}</div>
            )}
          </div>
        </div>
      )}

      {/* Riwayat Pembayaran */}
      {src === 'INTERIOR' && pembayarans.length > 0 && (
        <div className="td-card">
          <div className="td-section-head">
            <CreditCard size={13} color="#FA2F2F" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Riwayat Pembayaran</span>
          </div>
          <div>
            {pembayarans.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '10px 14px', borderBottom: i < pembayarans.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FA2F2F', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{TIPE_BAYAR[p.tipe] || p.tipe}</div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{formatTgl(p.tanggal)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: '#16a34a', flexShrink: 0 }}>{formatRp(p.jumlah)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dokumen */}
      <div className="td-card">
        <div className="td-section-head" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={13} color="#FA2F2F" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Dokumen</span>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{allDokumen.length} dokumen</span>
        </div>
        <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {allDokumen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              Belum ada dokumen.
            </div>
          ) : (
            <>
              {dokumen.invoices?.map(d => <DokCard key={`inv-${d.id}`} doc={d} />)}
              {dokumen.proformas?.map(d => <DokCard key={`pro-${d.id}`} doc={d} />)}
              {dokumen.subInvoices?.map(d => <DokCard key={`subinv-${d.id}`} doc={d} indent />)}
              {dokumen.suratJalans?.map(d => <DokCard key={`sj-${d.id}`} doc={d} indent />)}
              {dokumen.suratPengantars?.map(d => (
                <div key={`sp-${d.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <DokCard doc={d} indent />
                  {d.subs?.map(s => <DokCard key={`sub-${s.id}`} doc={s} indent />)}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ height: 'max(16px, env(safe-area-inset-bottom))' }} />

      {/* Login modal */}
      <Dialog open={loginModal} onClose={() => setLoginModal(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: '16px', mx: 2 } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, fontSize: 15 }}>
          <Lock size={17} color="#FA2F2F" /> Login Diperlukan
        </DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Untuk melihat detail dokumen, silakan login terlebih dahulu.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setLoginModal(false)} color="inherit" sx={{ fontWeight: 600, fontSize: 13 }}>Tutup</Button>
          <Button variant="contained"
            onClick={() => { const u = encodeURIComponent(window.location.pathname); router.push(`/login?return=${u}`); }}
            sx={{ borderRadius: '10px', fontWeight: 700, fontSize: 13, backgroundColor: '#FA2F2F', '&:hover': { backgroundColor: '#d41a1a' } }}>
            Login Sekarang
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
