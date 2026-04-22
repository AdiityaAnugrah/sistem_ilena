'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FileText, ArrowLeft, ExternalLink, Lock, Truck, CheckCircle2, Circle, Package, CreditCard, RotateCcw } from 'lucide-react';

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
  };
}

const TIPE_LABEL: Record<string, string> = {
  'invoice': 'Invoice',
  'surat-jalan': 'Surat Jalan',
  'sp': 'Surat Pengantar',
  'sp-sub': 'SP Sub',
  'proforma': 'Proforma Invoice',
  'surat-jalan-interior': 'Surat Jalan Interior',
  'invoice-interior': 'Invoice Interior',
  'sp-interior': 'Surat Pengantar Interior',
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
    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, persen)}%`,
        background: color, borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
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
        const d = await r.json();
        setData(d);
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
      window.open(`${API}/api/dokumen/${tipe}/${docId}/print?token=${printToken}`, '_blank');
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
    <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
      Penjualan tidak ditemukan.{' '}
      <button onClick={() => router.push('/surat')}
        style={{ background: 'none', border: 'none', color: '#FA2F2F', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
        Kembali
      </button>
    </div>
  );

  const { penjualan, sumber: src, ringkasan, dokumen, pembayarans = [] } = data;
  const nama = penjualan.nama_penerima || penjualan.nama_customer || '-';
  const noHp = penjualan.no_hp_penerima || penjualan.no_hp || null;
  const status = STATUS_LABEL[penjualan.status] || STATUS_LABEL['ACTIVE'];

  // ── Steps OFFLINE ──
  const stepsOffline = [
    { label: 'Pesanan Dibuat', done: true, icon: Package },
    { label: 'Invoice Diterbitkan', done: (dokumen.invoices?.length || 0) > 0, icon: FileText },
    { label: 'Barang Dikirim', done: (dokumen.suratJalans?.length || 0) > 0, icon: Truck },
    { label: 'Selesai', done: penjualan.status === 'COMPLETED', icon: CheckCircle2 },
  ];

  // ── Steps INTERIOR ──
  const stepsInterior = [
    { label: 'Pesanan Dibuat', done: true, icon: Package },
    { label: 'Proforma Invoice', done: (dokumen.proformas?.length || 0) > 0, icon: FileText },
    { label: 'Pengiriman', done: (dokumen.suratJalans?.length || 0) > 0, icon: Truck },
    { label: 'Invoice', done: (dokumen.invoices?.length || 0) > 0, icon: FileText },
    { label: 'Lunas', done: (ringkasan.sisa_tagihan || 0) === 0 && (ringkasan.total_bayar || 0) > 0, icon: CheckCircle2 },
  ];

  const steps = src === 'OFFLINE' ? stepsOffline : stepsInterior;
  const lastDoneIdx = steps.reduce((acc, s, i) => s.done ? i : acc, -1);

  const allDokumen = [
    ...(dokumen.invoices || []),
    ...(dokumen.proformas || []),
    ...(dokumen.suratJalans || []),
    ...(dokumen.suratPengantars || []),
  ];

  const DokCard = ({ doc, indent = false }: { doc: DokumenCard; indent?: boolean }) => (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderLeft: indent ? '3px solid #fca5a5' : '1px solid #e2e8f0',
      borderRadius: 10, padding: '11px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      marginLeft: indent ? 16 : 0,
    }}>
      <FileText size={14} color="#FA2F2F" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.nomor}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {TIPE_LABEL[doc.tipe] || doc.tipe}
          {doc.tanggal ? ` · ${formatTgl(doc.tanggal)}` : ''}
          {doc.jatuh_tempo ? ` · JT: ${formatTgl(doc.jatuh_tempo)}` : ''}
        </div>
      </div>
      <button onClick={() => handleLihat(doc.tipe, doc.id)} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 10px', borderRadius: 8,
        border: '1px solid #FA2F2F', background: 'transparent',
        color: '#FA2F2F', fontWeight: 600, fontSize: 11,
        cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        <ExternalLink size={10} /> Lihat
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Back */}
      <button onClick={() => router.push('/surat')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#64748b', fontSize: 13, padding: 0, width: 'fit-content',
      }}>
        <ArrowLeft size={14} /> Kembali ke daftar
      </button>

      {/* Header */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Penjualan {src}
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nama}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              <span>📅 {formatTgl(penjualan.tanggal)}</span>
              {noHp && <span>📱 {noHp}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <Chip label={status.label} size="small" sx={{ fontWeight: 700, fontSize: 10, backgroundColor: status.bg, color: status.color }} />
            <Chip label={src} size="small" sx={{ fontWeight: 700, fontSize: 10, backgroundColor: src === 'OFFLINE' ? '#eff6ff' : '#f0fdf4', color: src === 'OFFLINE' ? '#3b82f6' : '#16a34a' }} />
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === lastDoneIdx + 1;
            const isDone = step.done;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none', minWidth: 'fit-content' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? '#FA2F2F' : isActive ? '#fff7ed' : '#f1f5f9',
                    border: `2px solid ${isDone ? '#FA2F2F' : isActive ? '#fdba74' : '#e2e8f0'}`,
                    flexShrink: 0,
                  }}>
                    {isDone
                      ? <CheckCircle2 size={14} color="#fff" />
                      : <Icon size={14} color={isActive ? '#f97316' : '#94a3b8'} />
                    }
                  </div>
                  <div style={{ fontSize: 10, fontWeight: isDone || isActive ? 700 : 500, color: isDone ? '#FA2F2F' : isActive ? '#f97316' : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: step.done ? '#FA2F2F' : '#e2e8f0', margin: '0 6px', marginBottom: 18, minWidth: 16 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats — INTERIOR */}
      {src === 'INTERIOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {/* Tagihan */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={14} color="#FA2F2F" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pembayaran</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{formatRp(ringkasan.total_bayar || 0)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>dari {formatRp(ringkasan.grand_total || 0)}</div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar persen={ringkasan.persen_bayar || 0} color="#FA2F2F" />
              <div style={{ fontSize: 10, color: '#FA2F2F', fontWeight: 700, marginTop: 4 }}>{ringkasan.persen_bayar || 0}% terbayar</div>
            </div>
            {(ringkasan.sisa_tagihan || 0) > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                Sisa: {formatRp(ringkasan.sisa_tagihan || 0)}
              </div>
            )}
          </div>

          {/* Pengiriman */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={14} color="#16a34a" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pengiriman</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{ringkasan.sudah_kirim || 0} unit</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>dari {ringkasan.total_qty || 0} unit</div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar persen={ringkasan.persen_kirim || 0} color="#16a34a" />
              <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>{ringkasan.persen_kirim || 0}% terkirim</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats — OFFLINE */}
      {src === 'OFFLINE' && (ringkasan.total_nilai || 0) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={14} color="#FA2F2F" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pesanan</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{formatRp(ringkasan.total_nilai || 0)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ringkasan.total_qty || 0} item</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={14} color="#16a34a" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pengiriman</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{ringkasan.jumlah_sj || 0} Surat Jalan</div>
            {ringkasan.jatuh_tempo && (
              <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600, marginTop: 2 }}>JT: {formatTgl(ringkasan.jatuh_tempo)}</div>
            )}
          </div>
        </div>
      )}

      {/* Riwayat Pembayaran — INTERIOR */}
      {src === 'INTERIOR' && pembayarans.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={14} color="#FA2F2F" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Riwayat Pembayaran</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {pembayarans.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', gap: 10,
                borderBottom: i < pembayarans.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FA2F2F', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{TIPE_BAYAR[p.tipe] || p.tipe}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatTgl(p.tanggal)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{formatRp(p.jumlah)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dokumen */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} color="#FA2F2F" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Dokumen</span>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{allDokumen.length} dokumen</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allDokumen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
              Belum ada dokumen yang dibuat.
            </div>
          ) : (
            <>
              {dokumen.invoices?.map(d => <DokCard key={`inv-${d.id}`} doc={d} />)}
              {dokumen.proformas?.map(d => <DokCard key={`pro-${d.id}`} doc={d} />)}
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
