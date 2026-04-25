'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah, PEMBAYARAN_TIPE } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, Receipt, CreditCard, Truck,
  Package, User, Phone, Hash, Printer, FilePlus, RotateCcw, Pencil, AlertTriangle, Lock,
} from 'lucide-react';
import useAuthStore from '@/store/authStore';
import { useRoomPresence } from '@/hooks/useRoomPresence';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReturItem {
  id: number;
  surat_jalan_interior_id: number;
  penjualan_interior_item_id: number;
  qty_retur: number;
  tanggal: string;
  catatan?: string;
}

interface SuratPengantarInteriorData {
  id: number;
  nomor_surat: string;
  tanggal: string;
  surat_jalan_interior_id: number;
  catatan?: string;
  items: Array<{ id: number; nama_barang: string; qty: number }>;
}

interface SuratJalanInteriorData {
  id: number;
  nomor_surat: string;
  tanggal: string;
  catatan?: string;
  items: Array<{
    id: number;
    penjualan_interior_item_id: number;
    qty_kirim: number;
    item?: { nama_barang: string; kode_barang?: string };
  }>;
  returs?: ReturItem[];
}

// ─── Sub-komponen ──────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="text-xs w-32 flex-shrink-0 font-medium" style={{ color: '#94a3b8' }}>{label}</div>
    <div className="text-sm font-medium" style={{ color: '#1e293b' }}>{value || '-'}</div>
  </div>
);

const DocItem = ({ nomor, sub, onPrint, onAction, ActionIcon, actionLabel }: {
  nomor: string; sub: string; onPrint?: () => void;
  onAction?: () => void; ActionIcon?: React.ElementType; actionLabel?: string;
}) => (
  <div
    className="flex items-center justify-between p-3 rounded-xl"
    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
  >
    <div>
      <div className="text-xs font-mono font-medium" style={{ color: '#334155' }}>{nomor}</div>
      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{sub}</div>
    </div>
    <div className="flex items-center gap-2">
      {onAction && ActionIcon && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#f0fdf4';
            (e.currentTarget as HTMLElement).style.color = '#16a34a';
            (e.currentTarget as HTMLElement).style.border = '1px solid #bbf7d0';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#fff';
            (e.currentTarget as HTMLElement).style.color = '#475569';
            (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
          }}
        >
          <ActionIcon className="h-3.5 w-3.5" />
          {actionLabel || 'Aksi'}
        </button>
      )}
      {onPrint && (
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
      )}
    </div>
  </div>
);

const ModalWrapper = ({ show, onClose, children }: { show: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 animate-fade-in"
        style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const ModalHeader = ({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff1f1' }}>
      <Icon className="h-5 w-5" style={{ color: '#FA2F2F' }} />
    </div>
    <div>
      <h3 className="font-bold" style={{ color: '#0f172a' }}>{title}</h3>
      <p className="text-xs" style={{ color: '#94a3b8' }}>{sub}</p>
    </div>
  </div>
);

const modalInputStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' };
const modalInputClass = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all';
const modalFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.border = '1px solid #FA2F2F');
const modalBlur = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.border = '1px solid #e2e8f0');

const ModalInput = ({ label, type = 'text', value, onChange, placeholder }: any) => (
  <div>
    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>{label}</label>
    {type === 'date' ? (
      <DateInput value={value} onChange={onChange} className={modalInputClass} style={modalInputStyle} />
    ) : (
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={modalInputClass} style={modalInputStyle}
        onFocus={modalFocus} onBlur={modalBlur}
      />
    )}
  </div>
);

const ModalFooter = ({ onClose, onSubmit, loading, label, disabled }: any) => (
  <div className="flex gap-3 mt-5">
    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
      Batal
    </button>
    <button
      onClick={onSubmit} disabled={loading || disabled}
      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)', boxShadow: '0 2px 12px rgba(244,63,94,0.3)' }}
    >
      {loading ? 'Memproses...' : label}
    </button>
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label, desc }: any) => (
  <button
    onClick={onClick}
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
    <Icon className="h-4 w-4 flex-shrink-0" />
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-xs opacity-60 mt-0.5">{desc}</div>
    </div>
  </button>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PenjualanInteriorDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const canEditIdentitas = me && ['DEV', 'SUPER_ADMIN', 'ADMIN', 'TEST'].includes(me.role);
  const { others, dataUpdated, clearDataUpdated } = useRoomPresence(`penjualan-interior:${id}`, me?.id);
  const isLocked = others.length > 0;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit identitas states
  const [identitasModal, setIdentitasModal] = useState(false);
  const [identitasWarn, setIdentitasWarn] = useState(false);
  const [identitasForm, setIdentitasForm] = useState({ nama_customer: '', nama_pt_npwp: '', no_hp: '', no_po: '', no_npwp: '' });
  const [identitasLoading, setIdentitasLoading] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  // Form states
  const [proformaTanggal, setProformaTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [proformaCatatan, setProformaCatatan] = useState('');
  const [proformaTerms, setProformaTerms] = useState<{ tipe: string; jumlah: string }[]>([]);
  const [bayarProforma, setBayarProforma] = useState<any>(null);
  const [bayarTipe, setBayarTipe] = useState('DP');
  const [bayarJumlah, setBayarJumlah] = useState('');
  const [bayarTanggal, setBayarTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [bayarCatatan, setBayarCatatan] = useState('');
  const [sjTanggal, setSjTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sjCatatan, setSjCatatan] = useState('');
  const [sjItems, setSjItems] = useState<Record<number, number>>({});
  const [invIntTanggal, setInvIntTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [invIntSjIds, setInvIntSjIds] = useState<number[]>([]);
  const [invIntCatatan, setInvIntCatatan] = useState('');

  // Retur state
  const [returModal, setReturModal] = useState<{ open: boolean; sj: SuratJalanInteriorData | null }>({ open: false, sj: null });
  const [returForm, setReturForm] = useState<{
    tanggal: string;
    catatan: string;
    items: Array<{ penjualan_interior_item_id: number; kode_barang: string; nama_barang: string; qty_kirim: number; qty_retur: number | '' }>;
  }>({ tanggal: new Date().toISOString().split('T')[0], catatan: '', items: [] });
  const [returLoading, setReturLoading] = useState(false);

  // SP dari Retur state
  const [spReturModal, setSpReturModal] = useState<{ open: boolean; sjId: number | null; sj: SuratJalanInteriorData | null }>({ open: false, sjId: null, sj: null });
  const [spReturForm, setSpReturForm] = useState({ tanggal: new Date().toISOString().split('T')[0], keterangan: '' });
  const [spReturLoading, setSpReturLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get(`/penjualan-interior/${id}`);
      setData(res.data);
      const initQty: Record<number, number> = {};
      res.data.items?.forEach((item: any) => {
        const sisa = item.qty - item.sudah_kirim;
        if (sisa > 0) initQty[item.id] = sisa;
      });
      setSjItems(initQty);
      return res.data;
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const openIdentitasModal = () => {
    setIdentitasForm({
      nama_customer: data.nama_customer || '',
      nama_pt_npwp: data.nama_pt_npwp || '',
      no_hp: data.no_hp || '',
      no_po: data.no_po || '',
      no_npwp: data.no_npwp || '',
    });
    setIdentitasWarn(true);
  };

  const saveIdentitas = async () => {
    setIdentitasLoading(true);
    try {
      await api.patch(`/penjualan-interior/${id}/identitas`, identitasForm);
      toast.success('Identitas berhasil diperbarui');
      setIdentitasModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setIdentitasLoading(false);
    }
  };

  const createProforma = async () => {
    const hasZero = proformaTerms.some(t => !t.jumlah || Number(t.jumlah) <= 0);
    if (hasZero) { toast.error('Jumlah cicilan tidak boleh Rp 0 atau kosong'); return; }
    setDocLoading(true);
    try {
      const terms = proformaTerms
        .filter(t => t.tipe && Number(t.jumlah) > 0)
        .map(t => ({ tipe: t.tipe, jumlah: Number(t.jumlah) }));
      await api.post(`/penjualan-interior/${id}/proforma`, {
        tanggal: proformaTanggal,
        catatan: proformaCatatan,
        terms: terms.length > 0 ? terms : undefined,
      });
      toast.success('Proforma Invoice berhasil dibuat!');
      setModal(null); setProformaTerms([]); fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    } finally { setDocLoading(false); }
  };

  const createPembayaran = async () => {
    if (!bayarJumlah) { toast.error('Jumlah wajib diisi'); return; }
    setDocLoading(true);
    try {
      await api.post(`/penjualan-interior/${id}/pembayaran`, {
        tipe: bayarTipe, jumlah: bayarJumlah, tanggal: bayarTanggal, catatan: bayarCatatan,
      });
      toast.success('Pembayaran berhasil!');
      setModal(null); setBayarJumlah(''); fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    } finally { setDocLoading(false); }
  };

  const createSJ = async () => {
    const selectedItems = Object.entries(sjItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty_kirim]) => ({ penjualan_interior_item_id: Number(itemId), qty_kirim }));
    if (selectedItems.length === 0) { toast.error('Pilih minimal 1 item'); return; }
    setDocLoading(true);
    try {
      await api.post(`/penjualan-interior/${id}/surat-jalan`, { tanggal: sjTanggal, catatan: sjCatatan, items: selectedItems });
      toast.success('Surat Jalan berhasil dibuat!');
      setModal(null); fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    } finally { setDocLoading(false); }
  };

  const createInvoiceInterior = async () => {
    if (invIntSjIds.length === 0) { toast.error('Pilih minimal 1 Surat Jalan'); return; }
    setDocLoading(true);
    try {
      await api.post(`/penjualan-interior/${id}/invoice`, {
        tanggal: invIntTanggal, surat_jalan_ids: invIntSjIds, catatan: invIntCatatan,
      });
      toast.success('Invoice Interior berhasil dibuat!');
      setModal(null); setInvIntSjIds([]); fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    } finally { setDocLoading(false); }
  };

  const openReturModal = (sj: SuratJalanInteriorData) => {
    setReturForm({
      tanggal: new Date().toISOString().split('T')[0],
      catatan: '',
      items: sj.items.map((sjItem: any) => ({
        penjualan_interior_item_id: sjItem.penjualan_interior_item_id,
        kode_barang: sjItem.item?.kode_barang || '',
        nama_barang: sjItem.item?.nama_barang || '',
        qty_kirim: sjItem.qty_kirim,
        qty_retur: '',
      })),
    });
    setReturModal({ open: true, sj });
  };

  const handleSubmitRetur = async () => {
    const hasAny = returForm.items.some(i => Number(i.qty_retur) > 0);
    if (!hasAny) { toast.error('Minimal 1 item harus memiliki qty retur > 0'); return; }
    for (const i of returForm.items) {
      if (Number(i.qty_retur) > i.qty_kirim) {
        toast.error(`Qty retur tidak boleh melebihi qty kirim (${i.nama_barang})`);
        return;
      }
    }
    setReturLoading(true);
    try {
      const sjId = returModal.sj?.id;
      await api.post(`/penjualan-interior/${id}/retur-sj`, {
        surat_jalan_interior_id: sjId,
        tanggal: returForm.tanggal,
        catatan: returForm.catatan,
        items: returForm.items
          .filter(i => Number(i.qty_retur) > 0)
          .map(i => ({ penjualan_interior_item_id: i.penjualan_interior_item_id, qty_retur: Number(i.qty_retur) })),
      });
      toast.success('Retur berhasil dicatat!');
      setReturModal({ open: false, sj: null });
      const freshData = await fetchData();
      const freshSj = freshData?.suratJalans?.find((s: any) => s.id === sjId) ?? null;
      setSpReturForm({ tanggal: new Date().toISOString().split('T')[0], keterangan: '' });
      setSpReturModal({ open: true, sjId: sjId ?? null, sj: freshSj });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan retur');
    } finally {
      setReturLoading(false);
    }
  };

  const handleSubmitSpFromRetur = async () => {
    if (!spReturForm.tanggal) { toast.error('Tanggal wajib diisi'); return; }
    setSpReturLoading(true);
    try {
      const res = await api.post(`/penjualan-interior/${id}/sp-from-retur`, {
        surat_jalan_interior_id: spReturModal.sjId,
        tanggal: spReturForm.tanggal,
        keterangan: spReturForm.keterangan,
      });
      toast.success(`Surat Pengantar ${res.data.nomor_sp} berhasil dibuat!`);
      setSpReturModal({ open: false, sjId: null, sj: null });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat Surat Pengantar');
    } finally {
      setSpReturLoading(false);
    }
  };

  const printDoc = async (type: string, docId: number) => {
    try {
      const res = await api.post('/auth/print-token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      window.open(`${baseUrl}/dokumen/${type}/${docId}/print?token=${res.data.token}`, '_blank');
    } catch {
      toast.error('Gagal membuka dokumen');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton h-7 w-56 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2 skeleton h-72 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-sm" style={{ color: '#94a3b8' }}>Data tidak ditemukan</p>
    </div>
  );

  const subtotal = data.items?.reduce((s: number, i: any) => s + parseFloat(i.subtotal), 0) || 0;
  const ppn = data.pakai_ppn ? subtotal * (parseInt(data.ppn_persen) / 100) : 0;
  const grandTotal = subtotal + ppn;
  const totalBayar = data.pembayarans?.reduce((s: number, p: any) => s + parseFloat(p.jumlah), 0) || 0;
  const sisa = Math.max(0, grandTotal - totalBayar);

  return (
    <div className="space-y-6">
      {/* Real-time presence warning */}
      {isLocked && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
          <Lock className="h-4 w-4 shrink-0" style={{ color: '#d97706' }} />
          <span>
            <strong>{others.map(u => u.nama).join(', ')}</strong> lain sedang membuka halaman ini.
            Tombol edit dikunci sementara untuk mencegah konflik data.
          </span>
        </div>
      )}
      {/* Data updated notification */}
      {dataUpdated && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46' }}>
          <span>Data telah diperbarui oleh pengguna lain.</span>
          <button
            onClick={() => { clearDataUpdated(); window.location.reload(); }}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: '#059669', color: '#fff' }}
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
            Detail Penjualan Interior
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            No. PO: {data.no_po} · {formatDate(data.tanggal)} · {data.faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}
          </p>
        </div>
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
          style={
            data.status === 'ACTIVE' ? { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' } :
            data.status === 'COMPLETED' ? { background: '#fff1f1', color: '#FA2F2F', border: '1px solid #fecaca' } :
            { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }
          }
        >
          {data.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>Total Pesanan</div>
          <div className="text-base font-black" style={{ color: '#1e293b' }}>{formatRupiah(grandTotal)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#6ee7b7' }}>Total Terbayar</div>
          <div className="text-base font-black" style={{ color: '#059669' }}>{formatRupiah(totalBayar)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: sisa > 0 ? '#fff7ed' : '#ecfdf5', border: `1px solid ${sisa > 0 ? '#fed7aa' : '#a7f3d0'}`, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: sisa > 0 ? '#f97316' : '#6ee7b7' }}>Sisa Tagihan</div>
          <div className="text-base font-black" style={{ color: sisa > 0 ? '#c2410c' : '#059669' }}>{formatRupiah(sisa)}</div>
        </div>
      </div>

      {/* 2-column desktop layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT: Customer Info + Daftar Barang ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Informasi Customer */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" style={{ color: '#94a3b8' }} />
                <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Informasi Customer</h2>
              </div>
              {canEditIdentitas && (
                <button onClick={openIdentitasModal}
                  disabled={isLocked}
                  title={isLocked ? 'Dikunci — pengguna lain sedang membuka halaman ini' : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#fff1f1', color: '#FA2F2F', border: '1px solid #fecaca' }}
                  onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLElement).style.background = '#fee2e2'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff1f1'}>
                  {isLocked ? <Lock className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  Edit
                </button>
              )}
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <InfoRow label="Nama Customer" value={data.nama_customer} />
              <InfoRow label="PT / NPWP" value={data.nama_pt_npwp} />
              <InfoRow label="No. HP" value={data.no_hp} />
              <InfoRow label="Faktur" value={data.faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'} />
              {data.no_npwp && <InfoRow label="No. NPWP" value={data.no_npwp} />}
              {!!data.pakai_ppn && <InfoRow label="PPN" value={`${data.ppn_persen}%`} />}
            </div>
          </div>

          {/* Daftar Barang */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <Package className="h-4 w-4" style={{ color: '#94a3b8' }} />
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Daftar Barang</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Kode', 'Nama Barang', 'Terkirim', 'Harga', 'Subtotal'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-left" style={{ color: '#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((item: any, idx: number) => {
                    const done = item.sudah_kirim >= item.qty;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td className="px-5 py-3 text-xs font-mono" style={{ color: '#94a3b8' }}>{item.kode_barang}</td>
                        <td className="px-5 py-3 text-sm font-medium" style={{ color: '#1e293b' }}>{item.nama_barang}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={done ? { background: '#ecfdf5', color: '#059669' } : { background: '#fff7ed', color: '#c2410c' }}>
                            {item.sudah_kirim}/{item.qty}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: '#475569' }}>{formatRupiah(item.harga_satuan)}</td>
                        <td className="px-5 py-3 text-sm font-bold text-right" style={{ color: '#1e293b' }}>{formatRupiah(item.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td colSpan={4} className="px-5 py-3 text-sm font-bold text-right" style={{ color: '#475569' }}>Subtotal</td>
                    <td className="px-5 py-3 text-right font-bold" style={{ color: '#1e293b' }}>{formatRupiah(subtotal)}</td>
                  </tr>
                  {!!data.pakai_ppn && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={4} className="px-5 py-2 text-right text-sm" style={{ color: '#64748b' }}>PPN {data.ppn_persen}%</td>
                      <td className="px-5 py-2 text-right text-sm" style={{ color: '#64748b' }}>{formatRupiah(ppn)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={4} className="px-5 py-3 text-base font-black text-right" style={{ color: '#0f172a' }}>Total</td>
                    <td className="px-5 py-3 text-base font-black text-right" style={{ color: '#FA2F2F' }}>{formatRupiah(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Dokumen Panel ── */}
        <div className="space-y-4">
          {/* Buat Dokumen */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Buat Dokumen</h2>
            </div>
            <div className="p-4 space-y-2">
              <ActionButton onClick={() => setModal('proforma')} icon={FileText} label="Proforma Invoice" desc="Tagihan awal ke customer" />
              {data.items?.some((i: any) => i.qty - i.sudah_kirim > 0) && (
                <ActionButton onClick={() => setModal('sj')} icon={Truck} label="Surat Jalan" desc="Kirim barang ke customer" />
              )}
              <ActionButton onClick={() => setModal('invoice-interior')} icon={Receipt} label="Invoice Interior" desc="Tagihan berdasarkan pengiriman" />
            </div>
          </div>

          {/* Proforma Invoice & Pembayaran */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <FileText className="h-4 w-4" style={{ color: '#94a3b8' }} />
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Proforma & Pembayaran</h2>
            </div>
            <div className="p-4 space-y-3">
              {(!data.proformas || data.proformas.length === 0) ? (
                <p className="text-xs text-center py-2" style={{ color: '#94a3b8' }}>Belum ada proforma invoice</p>
              ) : (
                <div className="space-y-2">
                  {data.proformas.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div>
                        <div className="text-xs font-mono font-semibold" style={{ color: '#334155' }}>{p.nomor_proforma}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(p.tanggal)} · {formatRupiah(p.total)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setBayarProforma(p); setBayarTipe(''); setBayarJumlah(''); setModal('pembayaran'); }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLElement).style.color = '#16a34a'; (e.currentTarget as HTMLElement).style.border = '1px solid #bbf7d0'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0'; }}>
                          <CreditCard className="h-3 w-3" /> Bayar
                        </button>
                        <button onClick={() => printDoc('proforma', p.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.color = '#FA2F2F'; (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0'; }}>
                          <Printer className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.pembayarans?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2 pt-2" style={{ color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
                    Riwayat Pembayaran
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f1f5f9' }}>
                    <table className="w-full">
                      <tbody>
                        {data.pembayarans.map((p: any, idx: number) => (
                          <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f8fafc' }}>
                            <td className="px-3 py-2 text-xs" style={{ color: '#64748b' }}>{formatDate(p.tanggal)}</td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>
                                {p.tipe.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-right" style={{ color: '#059669' }}>{formatRupiah(p.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                          <td colSpan={2} className="px-3 py-2 text-xs font-bold" style={{ color: '#475569' }}>Total Terbayar</td>
                          <td className="px-3 py-2 text-right font-black text-xs" style={{ color: '#059669' }}>{formatRupiah(totalBayar)}</td>
                        </tr>
                        {sisa > 0 && (
                          <tr style={{ background: '#fef9f0' }}>
                            <td colSpan={2} className="px-3 py-2 text-xs font-semibold" style={{ color: '#92400e' }}>Sisa Tagihan</td>
                            <td className="px-3 py-2 text-right font-black text-xs" style={{ color: '#c2410c' }}>{formatRupiah(sisa)}</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Surat Jalan & Pengiriman */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <Truck className="h-4 w-4" style={{ color: '#94a3b8' }} />
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Surat Jalan</h2>
            </div>
            <div className="p-4 space-y-3">
              {(!data.suratJalans || data.suratJalans.length === 0) ? (
                <p className="text-xs text-center py-2" style={{ color: '#94a3b8' }}>Belum ada surat jalan</p>
              ) : (
                data.suratJalans.map((sj: any) => {
                  const spList: SuratPengantarInteriorData[] = (data.suratPengantars || []).filter(
                    (sp: SuratPengantarInteriorData) => sp.surat_jalan_interior_id === sj.id
                  );
                  return (
                    <div key={sj.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                      {/* SJ header */}
                      <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                          <div className="text-xs font-mono font-semibold" style={{ color: '#334155' }}>{sj.nomor_surat}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                            {formatDate(sj.tanggal)}{sj.catatan ? ` · ${sj.catatan}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => printDoc('surat-jalan-interior', sj.id)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.color = '#FA2F2F'; (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0'; }}>
                            <Printer className="h-3 w-3" />
                          </button>
                          <button onClick={() => openReturModal(sj)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff7ed'; (e.currentTarget as HTMLElement).style.color = '#c2410c'; (e.currentTarget as HTMLElement).style.border = '1px solid #fed7aa'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0'; }}>
                            <RotateCcw className="h-3 w-3" /> Retur
                          </button>
                        </div>
                      </div>

                      {/* Item list */}
                      <div className="px-3 py-2.5 space-y-1">
                        {(sj.items || []).map((sjItem: any) => (
                          <div key={sjItem.id} className="flex items-center justify-between text-xs">
                            <span style={{ color: '#334155' }}>• {sjItem.item?.nama_barang || '-'}</span>
                            <span className="font-semibold" style={{ color: '#475569' }}>{sjItem.qty_kirim} unit</span>
                          </div>
                        ))}
                      </div>

                      {/* Retur history + SP Retur button */}
                      {sj.returs?.length > 0 && (
                        <div className="px-3 py-2.5 space-y-2" style={{ background: '#fffbeb', borderTop: '1px solid #fef3c7' }}>
                          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>Riwayat Retur</div>
                          <div className="space-y-1">
                            {sj.returs.map((retur: any) => {
                              const sjItem = sj.items?.find((i: any) => i.penjualan_interior_item_id === retur.penjualan_interior_item_id);
                              return (
                                <div key={retur.id} className="flex items-center justify-between text-xs">
                                  <span style={{ color: '#92400e' }}>
                                    {sjItem?.item?.nama_barang || '-'}
                                    {retur.catatan ? <span className="italic ml-1 opacity-70">– {retur.catatan}</span> : null}
                                  </span>
                                  <span className="font-bold ml-4 flex-shrink-0" style={{ color: '#be123c' }}>-{retur.qty_retur} unit</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Tombol Buat SP — selalu tampil selama ada retur */}
                          <ActionButton
                            onClick={() => {
                              setSpReturForm({ tanggal: new Date().toISOString().split('T')[0], keterangan: '' });
                              setSpReturModal({ open: true, sjId: sj.id, sj });
                            }}
                            icon={FilePlus}
                            label="Buat Surat Pengantar Retur"
                            desc={`Antar kembali barang retur dari ${sj.nomor_surat}`}
                          />
                        </div>
                      )}

                      {/* SP list */}
                      {spList.length > 0 && (
                        <div className="px-3 py-2.5 space-y-2" style={{ background: '#f0f9ff', borderTop: '1px solid #bae6fd' }}>
                          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0369a1' }}>Surat Pengantar</div>
                          {spList.map((sp: SuratPengantarInteriorData) => (
                            <div key={sp.id} className="flex items-start justify-between gap-2 text-xs">
                              <div>
                                <div className="font-mono font-semibold" style={{ color: '#0c4a6e' }}>{sp.nomor_surat}</div>
                                <div className="mt-0.5" style={{ color: '#0369a1' }}>{formatDate(sp.tanggal)}</div>
                                <div className="mt-1 space-y-0.5">
                                  {sp.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2" style={{ color: '#075985' }}>
                                      <span>{item.nama_barang}</span>
                                      <span className="font-semibold flex-shrink-0">{item.qty} unit</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => printDoc('sp-interior', sp.id)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                                style={{ background: '#fff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                <Printer className="h-3 w-3" /> Cetak
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Invoice Interior */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <Receipt className="h-4 w-4" style={{ color: '#94a3b8' }} />
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Invoice Interior</h2>
            </div>
            <div className="p-4 space-y-2">
              {(!data.invoices || data.invoices.length === 0) ? (
                <p className="text-xs text-center py-2" style={{ color: '#94a3b8' }}>Belum ada invoice</p>
              ) : (
                data.invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div>
                      <div className="text-xs font-mono font-semibold" style={{ color: '#334155' }}>{inv.nomor_invoice}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(inv.tanggal)}</div>
                    </div>
                    <button onClick={() => printDoc('invoice-interior', inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.color = '#FA2F2F'; (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0'; }}>
                      <Printer className="h-3 w-3" /> Cetak
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>{/* end right column */}
      </div>{/* end main grid */}

      {/* ── Modal Proforma ── */}
      {modal === 'proforma' && (() => {
        // Hitung total sudah dibayar dari pembayaran sebelumnya
        const TIPE_LABEL_MAP: Record<string, string> = { DP: 'DP', TERMIN_1: 'Termin 1', TERMIN_2: 'Termin 2', TERMIN_3: 'Termin 3', PELUNASAN_AKHIR: 'Pelunasan Akhir' };
        const prevPembayarans: any[] = data.pembayarans || [];
        const totalSudahBayar = prevPembayarans.reduce((s: number, p: any) => s + Number(p.jumlah || 0), 0);
        const sisaTagihan = grandTotal - totalSudahBayar;

        const termTotal = proformaTerms.reduce((s, t) => s + (Number(t.jumlah) || 0), 0);
        const termOver = termTotal > sisaTagihan;
        const termUnder = proformaTerms.length > 0 && termTotal < sisaTagihan;
        const hasZeroTerms = proformaTerms.some(t => !t.jumlah || Number(t.jumlah) <= 0);
        const selisih = sisaTagihan - termTotal;
        const TIPE_OPTS = [
          { value: 'DP', label: 'DP (Uang Muka)' },
          { value: 'TERMIN_1', label: 'Termin 1' },
          { value: 'TERMIN_2', label: 'Termin 2' },
          { value: 'TERMIN_3', label: 'Termin 3' },
          { value: 'PELUNASAN_AKHIR', label: 'Pelunasan Akhir' },
        ];
        const nextTipe = TIPE_OPTS[Math.min(proformaTerms.length, TIPE_OPTS.length - 1)].value;
        return (
          <ModalWrapper show onClose={() => { setModal(null); setProformaTerms([]); }}>
            <ModalHeader icon={FileText} title="Buat Proforma Invoice" sub="Tagihan awal ke customer interior" />
            <div className="space-y-4">
              {/* Ringkasan total & riwayat pembayaran */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold" style={{ background: '#f8fafc' }}>
                  <span style={{ color: '#475569' }}>Total Tagihan</span>
                  <span style={{ color: '#0f172a' }}>{formatRupiah(grandTotal)}</span>
                </div>
                {prevPembayarans.length > 0 && (
                  <>
                    {prevPembayarans.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ background: '#f0fdf4', borderTop: '1px solid #dcfce7' }}>
                        <span style={{ color: '#15803d' }}>✓ {TIPE_LABEL_MAP[p.tipe] || p.tipe} ({p.tanggal ? new Date(p.tanggal).toLocaleDateString('id-ID') : '-'})</span>
                        <span className="font-semibold" style={{ color: '#15803d' }}>-{formatRupiah(Number(p.jumlah))}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 text-sm font-bold" style={{ background: '#eff6ff', borderTop: '1px solid #bfdbfe' }}>
                      <span style={{ color: '#1d4ed8' }}>Sisa Belum Dibayar</span>
                      <span style={{ color: '#1d4ed8' }}>{formatRupiah(Math.max(0, sisaTagihan))}</span>
                    </div>
                  </>
                )}
              </div>

              <ModalInput label="Tanggal" type="date" value={proformaTanggal} onChange={(e: any) => setProformaTanggal(e.target.value)} />

              {/* Cicilan Pembayaran */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: '#475569' }}>Cicilan Pembayaran <span className="font-normal text-slate-400">(opsional)</span></label>
                  <button type="button" onClick={() => setProformaTerms(prev => [...prev, { tipe: nextTipe, jumlah: '' }])}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                    + Tambah
                  </button>
                </div>

                {proformaTerms.length > 0 && (
                  <div className="space-y-2">
                    {proformaTerms.map((term, idx) => (
                      <div key={idx} className="flex gap-2 items-center p-2.5 rounded-lg"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <select value={term.tipe}
                          onChange={e => setProformaTerms(prev => prev.map((t, i) => i === idx ? { ...t, tipe: e.target.value } : t))}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none font-semibold"
                          style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b' }}>
                          {TIPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">Rp</span>
                          <input type="number" min={0} value={term.jumlah}
                            onChange={e => setProformaTerms(prev => prev.map((t, i) => i === idx ? { ...t, jumlah: e.target.value } : t))}
                            className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none font-bold"
                            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#1e293b' }}
                            placeholder="0" />
                        </div>
                        <button type="button" onClick={() => setProformaTerms(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">×</button>
                      </div>
                    ))}

                    {/* Validasi total cicilan */}
                    {hasZeroTerms ? (
                      <div className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                        ⚠ Jumlah cicilan tidak boleh Rp 0 atau kosong
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between"
                        style={{
                          background: termOver ? '#fef2f2' : termUnder ? '#fffbeb' : '#f0fdf4',
                          border: `1px solid ${termOver ? '#fecaca' : termUnder ? '#fde68a' : '#bbf7d0'}`,
                          color: termOver ? '#dc2626' : termUnder ? '#92400e' : '#15803d',
                        }}>
                        <span>Total cicilan: {formatRupiah(termTotal)}</span>
                        {termOver && <span>⚠ Melebihi sisa tagihan sebesar {formatRupiah(termTotal - sisaTagihan)}</span>}
                        {termUnder && <span>Sisa belum dialokasikan: {formatRupiah(selisih)}</span>}
                        {!termOver && !termUnder && termTotal > 0 && <span>✓ Sesuai sisa tagihan</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Catatan (opsional)</label>
                <textarea value={proformaCatatan} onChange={e => setProformaCatatan(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                  onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
                  onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
                />
              </div>
            </div>
            <ModalFooter
              onClose={() => { setModal(null); setProformaTerms([]); }}
              onSubmit={createProforma}
              loading={docLoading}
              label="Buat Proforma"
              disabled={termOver || proformaTerms.length === 0 || hasZeroTerms}
            />
          </ModalWrapper>
        );
      })()}

      {/* ── Modal Pembayaran ── */}
      {modal === 'pembayaran' && (() => {
        const closeBayar = () => { setModal(null); setBayarProforma(null); setBayarTipe(''); setBayarJumlah(''); };
        let terms: { tipe: string; jumlah: number }[] = [];
        try { terms = bayarProforma?.terms ? JSON.parse(bayarProforma.terms) : []; } catch { terms = []; }

        // Hitung berapa term per tipe yang sudah "diklaim" proforma-proforma sebelum ini
        const allProformas: any[] = data.proformas || [];
        const proformaIndex = allProformas.findIndex((p: any) => p.id === bayarProforma?.id);
        const tipeClaimedBefore: Record<string, number> = {};
        allProformas.slice(0, proformaIndex >= 0 ? proformaIndex : 0).forEach((prev: any) => {
          let prevTerms: { tipe: string }[] = [];
          try { prevTerms = prev.terms ? JSON.parse(prev.terms) : []; } catch {}
          prevTerms.forEach((t: any) => {
            const tt = t.tipe || 'DP';
            tipeClaimedBefore[tt] = (tipeClaimedBefore[tt] || 0) + 1;
          });
        });
        // Kelompokkan pembayaran nyata per tipe (urut masuk)
        const paymentsByTipe: Record<string, any[]> = {};
        (data.pembayarans || []).forEach((p: any) => {
          if (!paymentsByTipe[p.tipe]) paymentsByTipe[p.tipe] = [];
          paymentsByTipe[p.tipe].push(p);
        });
        // Untuk tiap term di proforma ini, tentukan apakah sudah dibayar secara sequential
        const tipeUsedCount: Record<string, number> = { ...tipeClaimedBefore };
        const termPaidMap: Map<number, boolean> = new Map();
        terms.forEach((term, idx) => {
          const tipe = term.tipe || 'DP';
          if (!tipeUsedCount[tipe]) tipeUsedCount[tipe] = 0;
          termPaidMap.set(idx, !!((paymentsByTipe[tipe] || [])[tipeUsedCount[tipe]]));
          tipeUsedCount[tipe]++;
        });
        const TIPE_LABEL: Record<string, string> = {
          DP: 'DP', TERMIN_1: 'Termin 1', TERMIN_2: 'Termin 2', TERMIN_3: 'Termin 3', PELUNASAN_AKHIR: 'Pelunasan Akhir',
        };
        const hasTerms = terms.length > 0;
        return (
          <ModalWrapper show onClose={closeBayar}>
            <ModalHeader icon={CreditCard} title="Catat Pembayaran" sub={bayarProforma ? `Proforma ${bayarProforma.nomor_proforma}` : 'Catat pembayaran dari customer'} />
            <div className="space-y-4">
              {hasTerms ? (
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>Pilih Cicilan yang Dibayar</label>
                  <div className="space-y-2">
                    {terms.map((term, termIdx) => {
                      const alreadyPaid = termPaidMap.get(termIdx) === true;
                      const isSelected = bayarTipe === term.tipe && !alreadyPaid;
                      return (
                        <button key={term.tipe} type="button" disabled={alreadyPaid}
                          onClick={() => { setBayarTipe(term.tipe); setBayarJumlah(String(term.jumlah)); }}
                          className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                          style={{
                            background: alreadyPaid ? '#f8fafc' : isSelected ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${alreadyPaid ? '#e2e8f0' : isSelected ? '#2563eb' : '#e2e8f0'}`,
                            opacity: alreadyPaid ? 0.55 : 1,
                            cursor: alreadyPaid ? 'not-allowed' : 'pointer',
                          }}>
                          <div>
                            <div className="text-xs font-semibold" style={{ color: alreadyPaid ? '#94a3b8' : '#1e293b' }}>
                              {TIPE_LABEL[term.tipe] || term.tipe}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{formatRupiah(term.jumlah)}</div>
                          </div>
                          {alreadyPaid ? (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>✓ Sudah dibayar</span>
                          ) : isSelected ? (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>Dipilih</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {bayarTipe && terms.some((t, i) => t.tipe === bayarTipe && !termPaidMap.get(i)) && (
                    <p className="text-xs mt-2" style={{ color: '#64748b' }}>
                      Jumlah: <strong>{formatRupiah(Number(bayarJumlah))}</strong> (sesuai proforma, tidak bisa diubah)
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Tipe Pembayaran</label>
                  <select value={bayarTipe} onChange={e => setBayarTipe(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                    {PEMBAYARAN_TIPE.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              )}
              {(!hasTerms) && (
                <ModalInput label="Jumlah (Rp)" type="number" value={bayarJumlah} onChange={(e: any) => setBayarJumlah(e.target.value)} placeholder="0" />
              )}
              <ModalInput label="Tanggal Pembayaran" type="date" value={bayarTanggal} onChange={(e: any) => setBayarTanggal(e.target.value)} />
              <ModalInput label="Catatan (opsional)" value={bayarCatatan} onChange={(e: any) => setBayarCatatan(e.target.value)} />
            </div>
            <ModalFooter onClose={closeBayar} onSubmit={createPembayaran} loading={docLoading} label="Simpan"
              disabled={!bayarTipe || !bayarJumlah} />
          </ModalWrapper>
        );
      })()}

      {/* ── Modal Surat Jalan ── */}
      <ModalWrapper show={modal === 'sj'} onClose={() => setModal(null)}>
        <ModalHeader icon={Truck} title="Buat Surat Jalan" sub="Pengiriman partial — pilih qty per item" />
        <div className="space-y-4">
          <ModalInput label="Tanggal" type="date" value={sjTanggal} onChange={(e: any) => setSjTanggal(e.target.value)} />
          <ModalInput label="Keterangan (opsional)" value={sjCatatan} onChange={(e: any) => setSjCatatan(e.target.value)} placeholder="Contoh: +PO/C001/..." />
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>Pilih Qty Kirim per Item</label>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {data.items?.filter((i: any) => i.qty - i.sudah_kirim > 0).map((item: any) => {
                const sisa = item.qty - item.sudah_kirim;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: '#1e293b' }}>{item.nama_barang}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Sisa: {sisa} unit</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Kirim:</span>
                      <input type="number" min={0} max={sisa} value={sjItems[item.id] || 0}
                        onChange={e => setSjItems(prev => ({ ...prev, [item.id]: Math.min(sisa, Number(e.target.value)) }))}
                        className="w-16 h-8 text-center rounded-lg text-sm outline-none"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <ModalFooter onClose={() => setModal(null)} onSubmit={createSJ} loading={docLoading} label="Buat Surat Jalan" />
      </ModalWrapper>

      {/* ── Modal Invoice Interior ── */}
      <ModalWrapper show={modal === 'invoice-interior'} onClose={() => { setModal(null); setInvIntSjIds([]); }}>
        <ModalHeader icon={Receipt} title="Buat Invoice Interior" sub="Invoice berdasarkan Surat Jalan yang ada" />
        <div className="space-y-4">
          <ModalInput label="Tanggal Invoice" type="date" value={invIntTanggal} onChange={(e: any) => setInvIntTanggal(e.target.value)} />
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>
              Surat Jalan Referensi <span className="font-normal" style={{ color: '#94a3b8' }}>(pilih satu atau lebih)</span>
            </label>
            {(!data.suratJalans || data.suratJalans.length === 0) ? (
              <p className="text-xs py-2" style={{ color: '#94a3b8' }}>Belum ada Surat Jalan</p>
            ) : (() => {
              // Kumpulkan semua SJ ID yang sudah dipakai di invoice sebelumnya
              const usedSjIds = new Set<number>();
              const sjInvoiceMap: Record<number, string> = {};
              (data.invoices || []).forEach((inv: any) => {
                let ids: number[] = [];
                if (inv.surat_jalan_ids) {
                  try { ids = JSON.parse(inv.surat_jalan_ids).map(Number); } catch { /* skip */ }
                } else if (inv.surat_jalan_interior_id) {
                  ids = [Number(inv.surat_jalan_interior_id)];
                }
                ids.forEach(sid => { usedSjIds.add(sid); sjInvoiceMap[sid] = inv.nomor_invoice; });
              });
              return (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.suratJalans.map((sj: any) => {
                    const checked = invIntSjIds.includes(sj.id);
                    const alreadyUsed = usedSjIds.has(sj.id);
                    const conflictNomor = sjInvoiceMap[sj.id];
                    return (
                      <label key={sj.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${alreadyUsed ? 'opacity-60' : 'cursor-pointer'}`}
                        style={{
                          background: alreadyUsed ? '#fafafa' : checked ? '#eff6ff' : '#f8fafc',
                          border: `1px solid ${alreadyUsed ? '#e2e8f0' : checked ? '#bfdbfe' : '#f1f5f9'}`,
                        }}>
                        <input type="checkbox" checked={checked} disabled={alreadyUsed}
                          onChange={e => !alreadyUsed && setInvIntSjIds(prev =>
                            e.target.checked ? [...prev, sj.id] : prev.filter(x => x !== sj.id)
                          )}
                          className="rounded" style={{ accentColor: '#2563eb' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-medium" style={{ color: alreadyUsed ? '#94a3b8' : '#334155' }}>{sj.nomor_surat}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(sj.tanggal)}</div>
                        </div>
                        {alreadyUsed && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            sudah di {conflictNomor}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              );
            })()}
            {invIntSjIds.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: '#2563eb' }}>{invIntSjIds.length} surat jalan dipilih</p>
            )}
          </div>
          <ModalInput label="Catatan (opsional)" value={invIntCatatan} onChange={(e: any) => setInvIntCatatan(e.target.value)} />
        </div>
        <ModalFooter onClose={() => { setModal(null); setInvIntSjIds([]); }} onSubmit={createInvoiceInterior} loading={docLoading} label="Buat Invoice" />
      </ModalWrapper>

      {/* ── Modal Retur ── */}
      <ModalWrapper show={returModal.open} onClose={() => setReturModal({ open: false, sj: null })}>
        <ModalHeader icon={RotateCcw} title={`Catat Retur – ${returModal.sj?.nomor_surat}`} sub="Catat barang yang dikembalikan dari customer" />
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>Item Retur</label>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {returForm.items.map((item, idx) => (
                <div key={item.penjualan_interior_item_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div className="flex-1 min-w-0">
                    {item.kode_barang && (
                      <div className="text-xs font-mono mb-0.5" style={{ color: '#94a3b8' }}>{item.kode_barang}</div>
                    )}
                    <div className="text-xs font-semibold truncate" style={{ color: '#1e293b' }}>{item.nama_barang}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Qty kirim: {item.qty_kirim}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#94a3b8' }}>Retur:</span>
                    <input
                      type="number" min={0} max={item.qty_kirim}
                      value={item.qty_retur}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Math.min(item.qty_kirim, Math.max(0, Number(e.target.value)));
                        setReturForm(prev => ({
                          ...prev,
                          items: prev.items.map((it, i) => i === idx ? { ...it, qty_retur: val } : it),
                        }));
                      }}
                      className="w-16 h-8 text-center rounded-lg text-sm outline-none"
                      style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ModalInput label="Tanggal Retur" type="date" value={returForm.tanggal} onChange={(e: any) => setReturForm(prev => ({ ...prev, tanggal: e.target.value }))} />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Catatan (opsional)</label>
            <textarea
              value={returForm.catatan}
              onChange={e => setReturForm(prev => ({ ...prev, catatan: e.target.value }))}
              rows={2}
              placeholder="Alasan retur..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
        </div>
        <ModalFooter onClose={() => setReturModal({ open: false, sj: null })} onSubmit={handleSubmitRetur} loading={returLoading} label="Simpan Retur" />
      </ModalWrapper>

      {/* ── Modal SP dari Retur ── */}
      <ModalWrapper show={spReturModal.open} onClose={() => setSpReturModal({ open: false, sjId: null, sj: null })}>
        <ModalHeader icon={FilePlus} title="Buat Surat Pengantar Retur" sub="Pengiriman kembali barang retur ke customer" />
        <div className="space-y-4">
          {/* Daftar barang wajib diantar kembali */}
          {spReturModal.sj && (() => {
            const returByItemId: Record<number, number> = {};
            for (const r of (spReturModal.sj.returs || [])) {
              returByItemId[r.penjualan_interior_item_id] = (returByItemId[r.penjualan_interior_item_id] || 0) + r.qty_retur;
            }
            const returItems = Object.entries(returByItemId)
              .map(([itemId, qty]) => {
                const sjItem = spReturModal.sj!.items.find(i => i.penjualan_interior_item_id === Number(itemId));
                return { nama: sjItem?.item?.nama_barang || `Item #${itemId}`, qty };
              })
              .filter(i => i.qty > 0);
            if (!returItems.length) return null;
            return (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>
                  Barang Wajib Diantar Kembali
                </label>
                <div className="space-y-1.5 p-3 rounded-xl" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  {returItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color: '#0c4a6e' }}>{item.nama}</span>
                      <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                        {item.qty} unit
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <ModalInput
            label="Tanggal Pengiriman *"
            type="date"
            value={spReturForm.tanggal}
            onChange={(e: any) => setSpReturForm(prev => ({ ...prev, tanggal: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Keterangan (opsional)</label>
            <textarea
              value={spReturForm.keterangan}
              onChange={e => setSpReturForm(prev => ({ ...prev, keterangan: e.target.value }))}
              rows={2}
              placeholder="Keterangan pengiriman kembali..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #0369a1'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
        </div>
        <ModalFooter onClose={() => setSpReturModal({ open: false, sjId: null, sj: null })} onSubmit={handleSubmitSpFromRetur} loading={spReturLoading} label="Buat Surat Pengantar" />
      </ModalWrapper>

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
                  Mengubah identitas customer akan <strong style={{ color: '#dc2626' }}>mempengaruhi semua dokumen</strong> yang sudah pernah dibuat (Proforma, Surat Jalan, Invoice, dll), karena dokumen mengacu langsung ke data ini saat dicetak.
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
                <h3 className="font-bold" style={{ color: '#0f172a' }}>Edit Identitas Customer</h3>
                <p className="text-xs" style={{ color: '#94a3b8' }}>Perubahan berlaku di semua dokumen terkait</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nama Customer', key: 'nama_customer', required: true },
                { label: 'PT / NPWP', key: 'nama_pt_npwp' },
                { label: 'No. HP', key: 'no_hp' },
                { label: 'No. PO', key: 'no_po' },
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
              <button onClick={saveIdentitas} disabled={identitasLoading || !identitasForm.nama_customer} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}>
                {identitasLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
