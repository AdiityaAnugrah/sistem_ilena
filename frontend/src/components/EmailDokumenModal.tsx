'use client';
import { useState, useEffect } from 'react';
import { Mail, X, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const REQUIRES_SIGNATURE = ['surat-jalan', 'surat-jalan-interior', 'sp', 'sp-sub', 'sp-interior'];

interface Props {
  open: boolean;
  onClose: () => void;
  tipe: string;         // e.g. 'surat-jalan', 'invoice', 'proforma', 'sub-invoice', 'sp-interior', etc.
  docId: number;
  nomor: string;
  defaultEmail?: string;
}

interface SigItem {
  id: string;
  url: string;
}

// Map tipe ke endpoint path
function getEmailPath(tipe: string, docId: number): string {
  if (tipe === 'sub-invoice') return `/dokumen/proforma/${docId}/sub-invoice/email`;
  return `/dokumen/${tipe}/${docId}/email`;
}

const TIPE_LABEL: Record<string, string> = {
  'surat-jalan': 'Surat Jalan',
  'invoice': 'Invoice',
  'sp': 'Surat Pengantar',
  'sp-sub': 'Sub Surat Pengantar',
  'proforma': 'Proforma Invoice',
  'sub-invoice': 'Sub Invoice',
  'surat-jalan-interior': 'Surat Jalan',
  'invoice-interior': 'Invoice',
  'sp-interior': 'Surat Pengantar',
};

export default function EmailDokumenModal({ open, onClose, tipe, docId, nomor, defaultEmail = '' }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [signatures, setSignatures] = useState<SigItem[]>([]);
  const [selectedSig, setSelectedSig] = useState<string | null>(null);
  const [sigsLoading, setSigsLoading] = useState(false);

  const needsSignature = REQUIRES_SIGNATURE.includes(tipe);

  useEffect(() => {
    if (!open || !needsSignature) return;
    setSigsLoading(true);
    api.get('/settings/signatures')
      .then(r => setSignatures(r.data || []))
      .catch(() => setSignatures([]))
      .finally(() => setSigsLoading(false));
  }, [open, needsSignature]);

  if (!open) return null;

  const handleClose = () => {
    if (status === 'loading') return;
    setStatus('idle');
    setErrorMsg('');
    setSelectedSig(null);
    onClose();
  };

  const canSend = !!email.trim() && (!needsSignature || !!selectedSig) && status !== 'loading';

  const handleSend = async () => {
    if (!canSend) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const body: Record<string, string> = { email: email.trim() };
      if (selectedSig) body.signatureId = selectedSig;
      await api.post(getEmailPath(tipe, docId), body);
      setStatus('success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal mengirim email';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const label = TIPE_LABEL[tipe] || tipe;
  // sig.url sudah mengandung /api/... jadi pakai origin saja (tanpa /api di akhir)
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', padding: '0 16px' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(15,23,42,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={17} color="#FA2F2F" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Kirim via Email</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label} · <span style={{ fontFamily: 'monospace' }}>{nomor}</span>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={16} color="#94a3b8" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 20px 24px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle2 size={26} color="#16a34a" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Email Terkirim!</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                PDF berhasil dikirim ke <strong>{email}</strong>
              </div>
              <button
                onClick={handleClose}
                style={{ marginTop: 20, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              {/* Email input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Alamat Email Tujuan
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="contoh@email.com"
                  disabled={status === 'loading'}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 13px', borderRadius: 10, outline: 'none',
                    border: `1.5px solid ${status === 'error' ? '#fca5a5' : '#e2e8f0'}`,
                    fontSize: 14, color: '#0f172a', background: status === 'loading' ? '#f8fafc' : '#fff',
                    boxSizing: 'border-box',
                  }}
                />
                {status === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <AlertCircle size={12} color="#ef4444" />
                    <span style={{ fontSize: 12, color: '#ef4444' }}>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Signature picker — hanya untuk dokumen yang butuh TTD */}
              {needsSignature && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Tanda Tangan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {sigsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', color: '#94a3b8', fontSize: 12 }}>
                      <Loader2 size={13} className="animate-spin" /> Memuat TTD…
                    </div>
                  ) : signatures.length === 0 ? (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fafafa', border: '1.5px dashed #e2e8f0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                      Belum ada TTD tersimpan.{' '}
                      <a href="/dashboard/pengaturan" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                        Upload di Pengaturan
                      </a>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {signatures.map(sig => (
                        <button
                          key={sig.id}
                          onClick={() => setSelectedSig(selectedSig === sig.id ? null : sig.id)}
                          disabled={status === 'loading'}
                          style={{
                            width: 80, height: 56, borderRadius: 8, padding: 4, cursor: 'pointer',
                            border: `2px solid ${selectedSig === sig.id ? '#3b82f6' : '#e2e8f0'}`,
                            background: selectedSig === sig.id ? '#eff6ff' : '#fafafa',
                            boxShadow: selectedSig === sig.id ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', overflow: 'hidden',
                          }}
                        >
                          <img
                            src={`${apiBase}${sig.url}`}
                            alt="TTD"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                          />
                          {selectedSig === sig.id && (
                            <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {!selectedSig && signatures.length > 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 5 }}>Pilih tanda tangan yang akan ditampilkan pada dokumen</div>
                  )}
                </div>
              )}

              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                PDF dokumen <strong style={{ color: '#64748b' }}>{label} {nomor}</strong> akan dikirim sebagai lampiran ke email di atas.
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleClose}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  style={{
                    flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                    background: !canSend ? '#94a3b8' : '#FA2F2F',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: !canSend ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  {status === 'loading' ? (
                    <><Loader2 size={14} className="animate-spin" /> Mengirim…</>
                  ) : (
                    <><Send size={14} /> Kirim Email</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
