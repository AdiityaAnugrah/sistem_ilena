'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import { FileText, ArrowLeft, ExternalLink, Lock } from 'lucide-react';

interface DokumenCard {
  id: number;
  nomor: string;
  tanggal?: string;
  tipe: string;
  subs?: { id: number; nomor: string; tipe: string }[];
}

interface TreeData {
  penjualan: {
    id: number;
    nama_penerima?: string;
    nama_customer?: string;
    tanggal: string;
    tipe?: string;
  };
  sumber: 'OFFLINE' | 'INTERIOR';
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
};

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

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

  const handleLihat = (tipe: string, docId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoginModal(true);
      return;
    }
    window.open(`${API}/api/dokumen/${tipe}/${docId}/print?token=${token}`, '_blank');
  };

  const formatTgl = (d?: string) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const DokCard = ({ doc, indent = false }: { doc: DokumenCard; indent?: boolean }) => (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderLeft: indent ? '3px solid #fca5a5' : '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginLeft: indent ? 20 : 0,
    }}>
      <FileText size={15} color="#FA2F2F" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>
          {doc.nomor}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
          {TIPE_LABEL[doc.tipe] || doc.tipe}
          {doc.tanggal ? ` · ${formatTgl(doc.tanggal)}` : ''}
        </div>
      </div>
      <button
        onClick={() => handleLihat(doc.tipe, doc.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid #FA2F2F', backgroundColor: 'transparent',
          color: '#FA2F2F', fontWeight: 600, fontSize: 12,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <ExternalLink size={12} />
        Lihat
      </button>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <CircularProgress />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
        Penjualan tidak ditemukan.{' '}
        <button
          onClick={() => router.push('/surat')}
          style={{ background: 'none', border: 'none', color: '#FA2F2F', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          Kembali
        </button>
      </div>
    );
  }

  const namaPenerima = data.penjualan.nama_penerima || data.penjualan.nama_customer || '-';

  const allDokumen = [
    ...(data.dokumen.invoices || []),
    ...(data.dokumen.suratJalans || []),
    ...(data.dokumen.suratPengantars || []),
    ...(data.dokumen.proformas || []),
  ];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => router.push('/surat')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 20, background: 'none', border: 'none',
          cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 0,
        }}
      >
        <ArrowLeft size={15} />
        Kembali ke Semua Surat
      </button>

      {/* Header penjualan */}
      <div style={{
        backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '18px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 11, color: '#94a3b8', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            Penjualan {data.sumber}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginTop: 4 }}>
            {namaPenerima}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {formatTgl(data.penjualan.tanggal)}
          </div>
        </div>
        <Chip
          label={data.sumber}
          sx={{
            fontWeight: 700, fontSize: 11,
            backgroundColor: data.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4',
            color: data.sumber === 'OFFLINE' ? '#3b82f6' : '#16a34a',
          }}
        />
      </div>

      {/* Jumlah dokumen */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14, fontWeight: 600 }}>
        {allDokumen.length} dokumen ditemukan
      </div>

      {/* Tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.dokumen.invoices?.map(d => (
          <DokCard key={`inv-${d.id}`} doc={d} />
        ))}
        {data.dokumen.proformas?.map(d => (
          <DokCard key={`pro-${d.id}`} doc={d} />
        ))}
        {data.dokumen.suratJalans?.map(d => (
          <DokCard key={`sj-${d.id}`} doc={d} indent />
        ))}
        {data.dokumen.suratPengantars?.map(d => (
          <div key={`sp-${d.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <DokCard doc={d} indent />
            {d.subs?.map(s => (
              <DokCard key={`sub-${s.id}`} doc={s} indent />
            ))}
          </div>
        ))}
      </div>

      {allDokumen.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
          Belum ada dokumen yang dibuat untuk penjualan ini.
        </div>
      )}

      {/* Login modal */}
      <Dialog
        open={loginModal}
        onClose={() => setLoginModal(false)}
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
          <Lock size={18} color="#FA2F2F" />
          Login Diperlukan
        </DialogTitle>
        <DialogContent>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            Untuk melihat detail dokumen, menambah tanda tangan, atau mengunduh, Anda perlu login terlebih dahulu.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setLoginModal(false)} color="inherit" sx={{ fontWeight: 600 }}>
            Tutup
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const returnUrl = encodeURIComponent(window.location.pathname);
              router.push(`/login?return=${returnUrl}`);
            }}
            sx={{
              borderRadius: '10px', fontWeight: 700,
              backgroundColor: '#FA2F2F',
              '&:hover': { backgroundColor: '#d41a1a' },
            }}
          >
            Login Sekarang
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
