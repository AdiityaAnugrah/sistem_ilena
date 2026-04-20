'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, Receipt, FilePlus, Printer,
  User, Phone, MapPin, Hash, Calendar, Package, ShoppingCart, Pencil, AlertTriangle, Lock, X,
} from 'lucide-react';

import useAuthStore from '@/store/authStore';
import { useRoomPresence } from '@/hooks/useRoomPresence';

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:     { label: 'Draft',    cls: 'badge-draft' },
    ACTIVE:    { label: 'Aktif',    cls: 'badge-active' },
    COMPLETED: { label: 'Selesai', cls: 'badge-completed' },
  };
  const s = map[status] || { label: status, cls: 'badge-draft' };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f8fafc' }}>
      <Icon className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
    </div>
    <div>
      <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: '#1e293b' }}>{value || '-'}</div>
    </div>
  </div>
);

const DocItem = ({ nomor, tanggal, onPrint }: { nomor: string; tanggal: string; onPrint: () => void }) => (
  <div
    className="flex items-center justify-between p-3 rounded-xl"
    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
  >
    <div>
      <div className="text-xs font-mono font-medium" style={{ color: '#334155' }}>{nomor}</div>
      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(tanggal)}</div>
    </div>
    <button
      onClick={onPrint}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = '#fff1f1';
        (e.currentTarget as HTMLElement).style.color = '#FA2F2F';
        (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = '#fff';
        (e.currentTarget as HTMLElement).style.color = '#475569';
        (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
      }}
    >
      <Printer className="h-3.5 w-3.5" />
      Cetak
    </button>
  </div>
);

// ─── Modal Buat Dokumen ──────────────────────────────────────────────────────
const DocModal = ({
  show, title, onClose, onSubmit, loading,
  tanggal, setTanggal, catatan, setCatatan,
  showPpn, ppn, setPpn,
}: any) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-fade-in"
        style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: '#fff1f1' }}
          >
            <FileText className="h-5 w-5" style={{ color: '#FA2F2F' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: '#0f172a' }}>{title}</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Isi data dokumen</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>
              Tanggal Dokumen
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
          {showPpn && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>
                PPN
              </label>
              <div className="flex gap-2">
                {([0, 10, 11] as const).map(p => (
                  <button key={p} type="button" onClick={() => setPpn(p)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: ppn === p ? 'linear-gradient(135deg, #FA2F2F, #d41a1a)' : '#f8fafc',
                      color: ppn === p ? '#fff' : '#475569',
                      border: ppn === p ? '1px solid #FA2F2F' : '1px solid #e2e8f0',
                    }}>
                    {p === 0 ? 'Tanpa PPN' : `PPN ${p}%`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>
              Catatan / Keterangan <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opsional)</span>
            </label>
            <textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              rows={3}
              placeholder="Contoh: *Pak Danil 0812-xxxx-xxxx"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none transition-all"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#f1f5f9', color: '#475569' }}
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)', boxShadow: '0 2px 12px rgba(244,63,94,0.3)' }}
          >
            {loading ? 'Membuat...' : 'Buat Dokumen'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Proses Jual Multiple Item Display ─────────────────────────────────
const JualMultipleModal = ({
  show, items, onClose, onSubmit, loading,
  form, setForm, faktur, setFaktur, fakturLocked,
  namaNpwp, setNamaNpwp, noNpwp, setNoNpwp,
  tanggal, setTanggal,
}: any) => {
  if (!show || !items) return null;

  const updateForm = (id: number, field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const selectedItems = items.filter((item: any) => (form[item.id]?.qty || 0) > 0);
  const totalQty = selectedItems.reduce((s: number, it: any) => s + (form[it.id]?.qty || 0), 0);
  const grandTotal = selectedItems.reduce((s: number, it: any) => {
    const f = form[it.id] || { qty: 0, harga: '' };
    const effectiveDisplay = it.harga_satuan * (1 - (it.diskon || 0) / 100);
    const diskonPct = (f.harga !== '' && Number(f.harga) > 0 && effectiveDisplay > 0)
      ? Math.max(0, Math.round((1 - Number(f.harga) / effectiveDisplay) * 100))
      : 0;
    return s + f.qty * effectiveDisplay * (1 - diskonPct / 100);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl animate-fade-in flex flex-col" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ecfdf5' }}>
            <ShoppingCart className="h-4 w-4" style={{ color: '#10b981' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm" style={{ color: '#0f172a' }}>Proses Penjualan Display</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Pilih barang yang terjual, tentukan qty & harga</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tanggal & Faktur */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Tanggal Penjualan</p>
              <input
                type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
                style={{ border: '1px solid #cbd5e1', background: '#fff' }}
              />
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>
                Jenis Dokumen
                {fakturLocked && <span className="ml-1.5 text-[10px] font-normal text-orange-500">(mengikuti penjualan sebelumnya)</span>}
              </p>
              <div className="flex gap-2">
                {(['NON_FAKTUR', 'FAKTUR'] as const).map(f => (
                  <button key={f} type="button"
                    onClick={() => !fakturLocked && setFaktur(f)}
                    disabled={fakturLocked}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: faktur === f ? 'linear-gradient(135deg, #FA2F2F, #d41a1a)' : '#fff',
                      color: faktur === f ? '#fff' : '#64748b',
                      border: faktur === f ? '1px solid #FA2F2F' : '1px solid #e2e8f0',
                      opacity: fakturLocked && faktur !== f ? 0.4 : 1,
                      cursor: fakturLocked ? 'not-allowed' : 'pointer',
                    }}>
                    {f === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* NPWP — wajib untuk semua jenis dokumen */}
          <div className="p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#475569' }}>Data NPWP / Identitas <span className="font-normal text-red-400">*wajib</span></p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Nama NPWP</label>
                <input type="text" value={namaNpwp} onChange={e => setNamaNpwp(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg outline-none"
                  style={{ border: '1px solid #cbd5e1', background: '#fff' }}
                  placeholder="Nama sesuai NPWP" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">No. NPWP / NIK</label>
                <input type="text" value={noNpwp}
                  onChange={e => setNoNpwp(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg outline-none"
                  style={{ border: '1px solid #cbd5e1', background: '#fff' }}
                  placeholder="Nomor NPWP atau NIK" />
              </div>
            </div>
          </div>

          {/* Daftar item */}
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: '#475569' }}>Pilih Barang yang Terjual</p>
            {items.map((item: any) => {
              const f = form[item.id] || { qty: 0, harga: '' };
              const isSelected = f.qty > 0;
              const effectiveDisplay = item.harga_satuan * (1 - (item.diskon || 0) / 100);
              const diskonPct = (f.harga !== '' && Number(f.harga) > 0 && effectiveDisplay > 0)
                ? Math.max(0, Math.round((1 - Number(f.harga) / effectiveDisplay) * 100))
                : 0;
              const subtotal = isSelected ? f.qty * effectiveDisplay * (1 - diskonPct / 100) : 0;
              return (
                <div key={item.id} className="p-4 rounded-xl border transition-all"
                  style={{ background: isSelected ? '#f0fdf4' : '#f8fafc', borderColor: isSelected ? '#86efac' : '#e2e8f0' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: '#1e293b' }}>
                        {item.barang?.nama || `Item #${item.id}`}
                      </div>
                      <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: '#94a3b8' }}>
                        <span>Sisa: <strong className="text-slate-700">{item.qty}</strong></span>
                        <span>Harga display: <strong className="text-slate-700">{formatRupiah(item.harga_satuan * (1 - (item.diskon || 0) / 100))}</strong></span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Subtotal</div>
                        <div className="text-sm font-bold" style={{ color: '#059669' }}>{formatRupiah(subtotal)}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="w-28 flex-shrink-0">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Qty Terjual</label>
                      <input
                        type="number" min={0} max={item.qty} step={1}
                        value={f.qty === 0 ? '' : f.qty}
                        onBeforeInput={(e: any) => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault(); }}
                        onChange={e => {
                          const v = Math.min(item.qty, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                          updateForm(item.id, 'qty', v);
                        }}
                        className="w-full px-2 py-1.5 text-sm rounded-lg outline-none text-center font-bold transition-all"
                        style={{ border: `1px solid ${isSelected ? '#86efac' : '#cbd5e1'}`, background: '#fff' }}
                        placeholder={`maks ${item.qty}`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">
                        Harga Jual <span className="normal-case text-slate-400 font-normal">(kosong = harga asal)</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                        <input
                          type="number" min={0} max={Math.round(effectiveDisplay)}
                          value={f.harga === '' ? '' : f.harga}
                          onBeforeInput={(e: any) => { if (e.data && !/[\d.]/.test(e.data)) e.preventDefault(); }}
                          onChange={e => updateForm(item.id, 'harga', e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg outline-none transition-all"
                          style={{ border: '1px solid #cbd5e1', background: '#fff' }}
                          placeholder={String(Math.round(effectiveDisplay))}
                        />
                      </div>
                      {f.harga !== '' && Number(f.harga) > 0 && effectiveDisplay > 0 && Number(f.harga) < effectiveDisplay && (
                        <div className="text-[10px] text-orange-500 font-semibold mt-0.5">
                          Diskon {Math.round((1 - Number(f.harga) / effectiveDisplay) * 100)}% dari harga display
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex-shrink-0 space-y-3" style={{ borderTop: '1px solid #e2e8f0' }}>
          {totalQty > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
              style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <span className="text-sm font-semibold" style={{ color: '#065f46' }}>
                {totalQty} barang terpilih · Total
              </span>
              <span className="text-base font-black" style={{ color: '#059669' }}>{formatRupiah(grandTotal)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all text-slate-600 bg-slate-100 hover:bg-slate-200">
              Batal
            </button>
            <button
              onClick={onSubmit}
              disabled={loading || totalQty === 0 || !namaNpwp.trim() || !noNpwp.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (totalQty > 0 && namaNpwp.trim() && noNpwp.trim()) ? 'linear-gradient(135deg, #10b981, #059669)' : '#94a3b8',
                boxShadow: (totalQty > 0 && namaNpwp.trim() && noNpwp.trim()) ? '0 2px 12px rgba(16,185,129,0.3)' : 'none',
              }}>
              {loading ? 'Memproses...' : !namaNpwp.trim() || !noNpwp.trim() ? 'Lengkapi data NPWP dulu' : totalQty > 0 ? `Proses ${totalQty} Barang Terjual` : 'Pilih barang dulu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PenjualanOfflineDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const canEditIdentitas = me && ['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(me.role);

  const { others, dataUpdated, clearDataUpdated } = useRoomPresence(
    id ? `penjualan-offline:${id}` : '',
    me?.id,
  );

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit identitas states
  const [identitasModal, setIdentitasModal] = useState(false);
  const [identitasWarn, setIdentitasWarn] = useState(false);
  const [identitasForm, setIdentitasForm] = useState({ nama_penerima: '', no_hp_penerima: '', no_po: '', nama_npwp: '', no_npwp: '' });
  const [identitasLoading, setIdentitasLoading] = useState(false);
  const [sjModal, setSjModal] = useState(false);
  const [invModal, setInvModal] = useState(false);
  const [spModal, setSpModal] = useState(false);
  const [sjConfirm, setSjConfirm] = useState(false);
  const [invConfirm, setInvConfirm] = useState(false);
  const [spConfirm, setSpConfirm] = useState(false);
  const [docTanggal, setDocTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [docCatatan, setDocCatatan] = useState('');
  const [docLoading, setDocLoading] = useState(false);

  // States for Jual Multiple Items Display
  const [jualModal, setJualModal] = useState(false);
  const [jualFaktur, setJualFaktur] = useState<'FAKTUR' | 'NON_FAKTUR'>('NON_FAKTUR');
  const [jualFakturLocked, setJualFakturLocked] = useState(false);
  const [jualNamaNpwp, setJualNamaNpwp] = useState('');
  const [jualNoNpwp, setJualNoNpwp] = useState('');
  const [jualTanggal, setJualTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jualForm, setJualForm] = useState<Record<number, { qty: number; harga: string }>>({});
  const [jualLoading, setJualLoading] = useState(false);

  // States for Invoice PPN
  const [invPpn, setInvPpn] = useState<0 | 10 | 11>(0);

  // States for Sub-SP
  const [subSpModal, setSubSpModal] = useState<{ sp: any } | null>(null);
  const [subSpSelected, setSubSpSelected] = useState<number[]>([]);
  const [subSpLoading, setSubSpLoading] = useState(false);

  const openJualModal = () => {
    const initForm: any = {};
    data.items.filter((it: any) => it.qty > 0).forEach((it: any) => {
      initForm[it.id] = { qty: 0, harga: '' };
    });
    setJualForm(initForm);
    setJualNamaNpwp(data.nama_npwp || '');
    setJualNoNpwp(data.no_npwp || '');
    setJualTanggal(new Date().toISOString().split('T')[0]);
    setJualModal(true);
  };

  const fetchData = async () => {
    try {
      const res = await api.get(`/penjualan-offline/${id}`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // Untuk DISPLAY: fetch laku sebelumnya → tentukan faktur yang harus dipakai
  useEffect(() => {
    if (!data || data.tipe !== 'DISPLAY') return;
    api.get(`/penjualan-offline/laku-dari-display/${id}`)
      .then(res => {
        if (res.data.length > 0) {
          const fakturLaku = res.data[0].faktur as 'FAKTUR' | 'NON_FAKTUR';
          setJualFaktur(fakturLaku);
          setJualFakturLocked(true);
        }
      })
      .catch(() => {});
  }, [data?.tipe, id]);

  const openIdentitasModal = () => {
    setIdentitasForm({
      nama_penerima: data.nama_penerima || '',
      no_hp_penerima: data.no_hp_penerima || '',
      no_po: data.no_po || '',
      nama_npwp: data.nama_npwp || '',
      no_npwp: data.no_npwp || '',
    });
    setIdentitasWarn(true);
  };

  const saveIdentitas = async () => {
    setIdentitasLoading(true);
    try {
      await api.patch(`/penjualan-offline/${id}/identitas`, identitasForm);
      toast.success('Identitas berhasil diperbarui');
      setIdentitasModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setIdentitasLoading(false);
    }
  };

  const closeAllModals = () => {
    setSjModal(false); setInvModal(false); setSpModal(false);
    setSjConfirm(false); setInvConfirm(false); setSpConfirm(false);
  };

  const openSjModal = () => {
    if ((data.suratJalans?.length ?? 0) > 0) { setSjConfirm(true); } else { setSjModal(true); }
  };
  const openInvModal = () => {
    if ((data.invoices?.length ?? 0) > 0) { setInvConfirm(true); } else { setInvModal(true); }
  };
  const openSpModal = () => {
    if ((data.suratPengantars?.length ?? 0) > 0) { setSpConfirm(true); } else { setSpModal(true); }
  };

  const createDoc = async (type: 'surat-jalan' | 'invoice' | 'surat-pengantar') => {
    setDocLoading(true);
    try {
      const extra = type === 'invoice' ? { ppn_persen: invPpn } : {};
      await api.post(`/penjualan-offline/${id}/${type}`, { tanggal: docTanggal, catatan: docCatatan, ...extra });
      toast.success('Dokumen berhasil dibuat!');
      closeAllModals();
      setDocCatatan('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat dokumen');
    } finally {
      setDocLoading(false);
    }
  };

  const prosesJualItem = async () => {
    // Kumpulkan payload dari items terjual
    const selectedItems = Object.keys(jualForm).map(key => {
      const idStr = Number(key);
      const f = jualForm[idStr];
      if (f.qty > 0) {
        // Cari item asal diskon
        const baseItem = data.items.find((x: any) => x.id === idStr);
        return {
          item_id: idStr,
          qty_jual: f.qty,
          harga_jual: f.harga !== '' ? Number(f.harga) : undefined,
          diskon: 0
        };
      }
      return null;
    }).filter(Boolean);

    if (selectedItems.length === 0) return;

    setJualLoading(true);
    try {
      const res = await api.post(`/penjualan-offline/${id}/proses-jual-item`, {
        items: selectedItems,
        faktur: jualFaktur,
        nama_npwp: jualNamaNpwp || null,
        no_npwp: jualNoNpwp || null,
        tanggal: jualTanggal,
      });
      
      const newPenjualanId = res.data.new_penjualan_id;
      toast.success(
        (t) => (
          <span>
            Barang display berhasil diproses jadi terjual! 
            <button 
              onClick={() => { toast.dismiss(t.id); router.push(`/dashboard/penjualan/offline/${newPenjualanId}`); }} 
              className="ml-2 font-bold underline text-red-600 dark:text-red-400"
            >
              Lihat Nota Penjualan
            </button>
          </span>
        ),
        { duration: 8000 }
      );
      
      setJualModal(false);
      fetchData(); // refresh sisa item display
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses item terjual');
    } finally {
      setJualLoading(false);
    }
  };

  const saveSubSp = async () => {
    if (!subSpModal || subSpSelected.length === 0) return;
    setSubSpLoading(true);
    try {
      await api.post(`/penjualan-offline/sp/${subSpModal.sp.id}/sub-sp`, { item_ids: subSpSelected });
      toast.success('Sub-SP berhasil dibuat');
      setSubSpModal(null);
      setSubSpSelected([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat sub-SP');
    } finally {
      setSubSpLoading(false);
    }
  };

  const printDoc = (type: string, docId: number) => {
    const token = localStorage.getItem('token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    window.open(`${baseUrl}/dokumen/${type}/${docId}/print?token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton h-7 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm" style={{ color: '#94a3b8' }}>Data tidak ditemukan</p>
      </div>
    );
  }

  const isPenjualan = data.tipe === 'PENJUALAN';
  const total = data.items?.reduce((s: number, i: any) => s + parseFloat(i.subtotal), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Banner: user lain sedang melihat/mengedit halaman ini */}
      {others.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <span>
            <strong>{others.map(u => u.nama).join(', ')}</strong> sedang membuka halaman ini secara bersamaan.
            Koordinasikan sebelum melakukan perubahan untuk menghindari konflik data.
          </span>
        </div>
      )}

      {/* Banner: data diperbarui oleh user lain */}
      {dataUpdated && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">🔄</span>
            <span>Data halaman ini baru saja diperbarui oleh pengguna lain.</span>
          </div>
          <button
            onClick={() => { clearDataUpdated(); fetchData(); }}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0"
            style={{ background: '#16a34a', color: '#fff' }}
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl transition-all"
          style={{ background: '#fff', border: '1px solid #e2e8f0' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: '#475569' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#0f172a' }}>
            Detail {isPenjualan ? 'Penjualan' : 'Display'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            {formatDate(data.tanggal)}{isPenjualan ? ` · ${data.faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}` : ''}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — info + items */}
        <div className="lg:col-span-2 space-y-5">
          {/* Identitas Penerima */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Identitas Penerima</h2>
              {canEditIdentitas && (
                <button
                  onClick={openIdentitasModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: '#fff1f1', color: '#FA2F2F', border: '1px solid #fecaca' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fee2e2'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff1f1'}
                >
                  <Pencil className="h-3 w-3" /> Edit Identitas
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={User}     label="Nama Penerima"  value={data.nama_penerima} />
              <InfoRow icon={Phone}    label="Nomor HP"       value={data.no_hp_penerima} />
              {data.no_po    && <InfoRow icon={Hash}     label="No. PO"         value={data.no_po} />}
              {data.nama_npwp && <InfoRow icon={FileText} label="Nama NPWP"     value={data.nama_npwp} />}
              {data.no_npwp  && <InfoRow icon={Hash}     label="No. NPWP"       value={data.no_npwp} />}
            </div>
            {(data.pengirim_detail || data.pengirimKelurahan || data.pengirimProvinsi) && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                <InfoRow
                  icon={MapPin}
                  label="Alamat Pengiriman"
                  value={[
                    data.pengirim_detail,
                    data.pengirimKelurahan?.label,
                    data.pengirimKecamatan?.label,
                    data.pengirimKabupaten?.label,
                    data.pengirimProvinsi?.label,
                    data.pengirim_kode_pos ? `Kode Pos ${data.pengirim_kode_pos}` : null,
                  ].filter(Boolean).join(', ')}
                />
              </div>
            )}
          </div>

          {/* Daftar Produk */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" style={{ color: '#94a3b8' }} />
                <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Daftar Produk</h2>
              </div>
              {!isPenjualan && (
                (data.suratPengantars?.length ?? 0) > 0 ? (
                  data.items?.some((it: any) => it.qty > 0) && (
                    <button
                      onClick={openJualModal}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Pilih & Proses Barang Terjual
                    </button>
                  )
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: '#fefce8', border: '1px solid #fde047', color: '#854d0e' }}>
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    Buat Surat Pengantar dulu
                  </div>
                )
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Produk', 'Qty', 'Harga Satuan', 'Diskon', 'Subtotal'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-left" style={{ color: '#94a3b8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((item: any, idx: number) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: idx < data.items.length - 1 ? '1px solid #f8fafc' : 'none',
                        background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-semibold" style={{ color: '#1e293b' }}>
                          {item.barang?.nama || item.barang_id}
                        </div>
                        {item.barang?.kode && (
                          <div className="text-xs font-mono mt-0.5" style={{ color: '#94a3b8' }}>
                            {item.barang.kode}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-center" style={{ color: '#475569' }}>
                        {item.qty}
                      </td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#475569' }}>
                        {formatRupiah(item.harga_satuan)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-center" style={{ color: '#475569' }}>
                        {item.diskon ? `${item.diskon}%` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-bold text-right">
                        <div style={{ color: '#1e293b' }}>{formatRupiah(item.subtotal)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td colSpan={4} className="px-5 py-3.5 text-sm font-bold text-right" style={{ color: '#475569' }}>
                      Total
                    </td>
                    <td className="px-5 py-3.5 text-base font-black text-right" style={{ color: '#FA2F2F' }}>
                      {formatRupiah(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right — dokumen */}
        <div className="space-y-4">
          {/* Buat Dokumen */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: '#1e293b' }}>Buat Dokumen</h2>
            <div className="space-y-2">
              {isPenjualan ? (
                <>
                  <button
                    onClick={openSjModal}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', textAlign: 'left' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#fff1f1';
                      (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca';
                      (e.currentTarget as HTMLElement).style.color = '#FA2F2F';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                      (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                      (e.currentTarget as HTMLElement).style.color = '#334155';
                    }}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Surat Jalan</div>
                      <div className="text-xs opacity-60 mt-0.5">Dokumen pengiriman barang</div>
                    </div>
                  </button>
                  <button
                    onClick={openInvModal}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', textAlign: 'left' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#fff1f1';
                      (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca';
                      (e.currentTarget as HTMLElement).style.color = '#FA2F2F';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                      (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                      (e.currentTarget as HTMLElement).style.color = '#334155';
                    }}
                  >
                    <Receipt className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Invoice</div>
                      <div className="text-xs opacity-60 mt-0.5">Tagihan ke customer</div>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={openSpModal}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', textAlign: 'left' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = '#fff1f1';
                    (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca';
                    (e.currentTarget as HTMLElement).style.color = '#FA2F2F';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                    (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                    (e.currentTarget as HTMLElement).style.color = '#334155';
                  }}
                >
                  <FilePlus className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Surat Pengantar</div>
                    <div className="text-xs opacity-60 mt-0.5">Dokumen untuk display</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Surat Jalan list */}
          {data.suratJalans?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                  Surat Jalan
                </h3>
              </div>
              <div className="space-y-2">
                {data.suratJalans.map((sj: any) => (
                  <DocItem
                    key={sj.id}
                    nomor={sj.nomor_surat}
                    tanggal={sj.tanggal}
                    onPrint={() => printDoc('surat-jalan', sj.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Invoice list */}
          {data.invoices?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                  Invoice
                </h3>
              </div>
              <div className="space-y-2">
                {data.invoices.map((inv: any) => (
                  <DocItem
                    key={inv.id}
                    nomor={inv.nomor_invoice}
                    tanggal={inv.tanggal}
                    onPrint={() => printDoc('invoice', inv.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Surat Pengantar list */}
          {data.suratPengantars?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <FilePlus className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                  Surat Pengantar
                </h3>
              </div>
              <div className="space-y-3">
                {data.suratPengantars.map((sp: any) => (
                  <div key={sp.id}>
                    <DocItem
                      nomor={sp.nomor_sp}
                      tanggal={sp.tanggal}
                      onPrint={() => printDoc('sp', sp.id)}
                    />
                    {/* Sub-SP section */}
                    <div className="mt-2 ml-3 pl-3" style={{ borderLeft: '2px solid #f1f5f9' }}>
                      {sp.subs?.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {sp.subs.map((sub: any) => (
                            <div key={sub.id}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                              style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
                            >
                              <span className="text-xs font-mono font-medium" style={{ color: '#334155' }}>
                                {sub.nomor_sp_sub}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs" style={{ color: '#94a3b8' }}>
                                  {sub.item?.barang?.nama || `Item #${sub.penjualan_offline_item_id}`}
                                </span>
                                <button
                                  onClick={() => printDoc('sp-sub', sub.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all"
                                  style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.color = '#FA2F2F'; (e.currentTarget as HTMLElement).style.borderColor = '#fecaca'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
                                >
                                  <Printer className="h-3 w-3" /> Cetak
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Tombol tambah sub-SP baru (hanya jika masih ada item yang belum dapat sub-SP) */}
                      {(() => {
                        const existingItemIds = sp.subs?.map((s: any) => s.penjualan_offline_item_id) || [];
                        const availableItems = data.items?.filter((it: any) => !existingItemIds.includes(it.id)) || [];
                        if (availableItems.length === 0) return (
                          <p className="text-xs" style={{ color: '#94a3b8' }}>Semua item sudah memiliki Sub-SP</p>
                        );
                        return (
                          <button
                            onClick={() => { setSubSpModal({ sp }); setSubSpSelected([]); }}
                            className="text-xs font-medium flex items-center gap-1 transition-colors"
                            style={{ color: '#94a3b8' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FA2F2F'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
                          >
                            <FilePlus className="h-3 w-3" />
                            Tambah Sub-SP ({availableItems.length} item tersedia)
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Confirm double-doc modals */}
      {[
        { show: sjConfirm, label: 'Surat Jalan', count: data?.suratJalans?.length ?? 0, onConfirm: () => { setSjConfirm(false); setSjModal(true); } },
        { show: invConfirm, label: 'Invoice', count: data?.invoices?.length ?? 0, onConfirm: () => { setInvConfirm(false); setInvModal(true); } },
        { show: spConfirm, label: 'Surat Pengantar', count: data?.suratPengantars?.length ?? 0, onConfirm: () => { setSpConfirm(false); setSpModal(true); } },
      ].map(({ show, label, count, onConfirm }) => show ? (
        <div key={label} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#0f172a' }}>Sudah Ada {label}</h3>
                <p className="text-xs" style={{ color: '#94a3b8' }}>Dokumen ini sudah dibuat sebelumnya</p>
              </div>
            </div>
            <p className="text-sm mb-5" style={{ color: '#475569' }}>
              Penjualan ini sudah memiliki <strong>{count} {label}</strong>. Yakin ingin membuat {label} baru lagi?
            </p>
            <div className="flex gap-3">
              <button onClick={closeAllModals} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                Batal
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: '#f59e0b' }}>
                Tetap Buat
              </button>
            </div>
          </div>
        </div>
      ) : null)}

      <DocModal
        show={sjModal} title="Buat Surat Jalan"
        onClose={closeAllModals} onSubmit={() => createDoc('surat-jalan')}
        loading={docLoading} tanggal={docTanggal} setTanggal={setDocTanggal}
        catatan={docCatatan} setCatatan={setDocCatatan}
      />
      <DocModal
        show={invModal} title="Buat Invoice"
        onClose={closeAllModals} onSubmit={() => createDoc('invoice')}
        loading={docLoading} tanggal={docTanggal} setTanggal={setDocTanggal}
        catatan={docCatatan} setCatatan={setDocCatatan}
        showPpn ppn={invPpn} setPpn={setInvPpn}
      />
      <DocModal
        show={spModal} title="Buat Surat Pengantar"
        onClose={closeAllModals} onSubmit={() => createDoc('surat-pengantar')}
        loading={docLoading} tanggal={docTanggal} setTanggal={setDocTanggal}
        catatan={docCatatan} setCatatan={setDocCatatan}
      />
      <JualMultipleModal
        show={jualModal} items={data.items.filter((it: any) => it.qty > 0)}
        onClose={() => setJualModal(false)}
        onSubmit={prosesJualItem} loading={jualLoading}
        form={jualForm} setForm={setJualForm}
        faktur={jualFaktur} setFaktur={setJualFaktur} fakturLocked={jualFakturLocked}
        namaNpwp={jualNamaNpwp} setNamaNpwp={setJualNamaNpwp}
        noNpwp={jualNoNpwp} setNoNpwp={setJualNoNpwp}
        tanggal={jualTanggal} setTanggal={setJualTanggal}
      />

      {/* Sub-SP Modal */}
      {subSpModal && (() => {
        const sp = subSpModal.sp;
        const existingItemIds: number[] = sp.subs?.map((s: any) => s.penjualan_offline_item_id) || [];
        const startUrutan = existingItemIds.length + 1;
        const availableItems = data.items?.filter((it: any) => !existingItemIds.includes(it.id)) || [];
        const seq = sp.nomor_sp.split('/')[0];
        const rest = sp.nomor_sp.split('/').slice(1).join('/');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 animate-fade-in" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff1f1' }}>
                  <FilePlus className="h-5 w-5" style={{ color: '#FA2F2F' }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: '#0f172a' }}>Tambah Sub-SP per Item</h3>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>SP Utama: {sp.nomor_sp}</p>
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                Pilih item yang akan mendapat Sub-SP. Contoh nomor: <span className="font-mono font-semibold">{seq}/B{String(startUrutan).padStart(2,'0')}/{rest}</span>
              </p>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {availableItems.map((item: any) => {
                  const isChecked = subSpSelected.includes(item.id);
                  const orderIndex = subSpSelected.indexOf(item.id);
                  const urutanLabel = startUrutan + orderIndex;
                  return (
                    <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{ background: isChecked ? '#fff1f1' : '#f8fafc', border: `1px solid ${isChecked ? '#fecaca' : '#f1f5f9'}` }}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => setSubSpSelected(prev =>
                          prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                        )}
                        className="w-4 h-4 accent-red-600"
                      />
                      <div className="flex-1 text-sm font-medium" style={{ color: '#1e293b' }}>
                        {item.barang?.nama || item.barang_id}
                      </div>
                      {isChecked && (
                        <span className="text-xs font-mono font-bold" style={{ color: '#FA2F2F' }}>
                          {seq}/B{String(urutanLabel).padStart(2,'0')}/{rest}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setSubSpModal(null); setSubSpSelected([]); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
                  Batal
                </button>
                <button onClick={saveSubSp} disabled={subSpLoading || subSpSelected.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}>
                  {subSpLoading ? 'Menyimpan...' : `Buat ${subSpSelected.length} Sub-SP`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Warning Modal Identitas */}
      {identitasWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 animate-fade-in" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff7ed' }}>
                <AlertTriangle className="h-5 w-5" style={{ color: '#f97316' }} />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#0f172a' }}>Perhatian!</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748b' }}>
                  Mengubah identitas penerima akan <strong style={{ color: '#dc2626' }}>mempengaruhi semua dokumen</strong> yang sudah pernah dibuat (Surat Jalan, Invoice, Surat Pengantar, dll), karena dokumen mengacu langsung ke data ini saat dicetak.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setIdentitasWarn(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
                Batal
              </button>
              <button onClick={() => { setIdentitasWarn(false); setIdentitasModal(true); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                Lanjutkan Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Identitas Modal */}
      {identitasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 animate-fade-in" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff1f1' }}>
                <Pencil className="h-5 w-5" style={{ color: '#FA2F2F' }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: '#0f172a' }}>Edit Identitas Penerima</h3>
                <p className="text-xs" style={{ color: '#94a3b8' }}>Perubahan berlaku di semua dokumen terkait</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nama Penerima', key: 'nama_penerima', required: true },
                { label: 'Nomor HP', key: 'no_hp_penerima' },
                { label: 'No. PO', key: 'no_po' },
                { label: 'Nama NPWP', key: 'nama_npwp' },
                { label: 'No. NPWP', key: 'no_npwp' },
              ].map(({ label, key, required }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>
                    {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input
                    type="text"
                    value={(identitasForm as any)[key]}
                    onChange={e => setIdentitasForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                    onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
                    onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setIdentitasModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
                Batal
              </button>
              <button onClick={saveIdentitas} disabled={identitasLoading || !identitasForm.nama_penerima} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}>
                {identitasLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
