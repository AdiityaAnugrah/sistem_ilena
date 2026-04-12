'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, formatRupiah, PEMBAYARAN_TIPE } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, Receipt, CreditCard, Truck,
  Package, User, Phone, Hash, Printer, FilePlus, RotateCcw, Pencil, AlertTriangle,
} from 'lucide-react';
import useAuthStore from '@/store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReturItem {
  id: number;
  surat_jalan_interior_id: number;
  penjualan_interior_item_id: number;
  qty_retur: number;
  tanggal: string;
  catatan?: string;
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
    item?: { nama_barang: string };
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

const DocItem = ({ nomor, sub, onPrint }: { nomor: string; sub: string; onPrint?: () => void }) => (
  <div
    className="flex items-center justify-between p-3 rounded-xl"
    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
  >
    <div>
      <div className="text-xs font-mono font-medium" style={{ color: '#334155' }}>{nomor}</div>
      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{sub}</div>
    </div>
    {onPrint && (
      <button
        onClick={onPrint}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = '#eff6ff';
          (e.currentTarget as HTMLElement).style.color = '#2563eb';
          (e.currentTarget as HTMLElement).style.border = '1px solid #bfdbfe';
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
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
      <Icon className="h-5 w-5" style={{ color: '#2563eb' }} />
    </div>
    <div>
      <h3 className="font-bold" style={{ color: '#0f172a' }}>{title}</h3>
      <p className="text-xs" style={{ color: '#94a3b8' }}>{sub}</p>
    </div>
  </div>
);

const ModalInput = ({ label, type = 'text', value, onChange, placeholder }: any) => (
  <div>
    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>{label}</label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
      onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
      onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
    />
  </div>
);

const ModalFooter = ({ onClose, onSubmit, loading, label }: any) => (
  <div className="flex gap-3 mt-5">
    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
      Batal
    </button>
    <button
      onClick={onSubmit} disabled={loading}
      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 12px rgba(244,63,94,0.3)' }}
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
      (e.currentTarget as HTMLElement).style.background = '#eff6ff';
      (e.currentTarget as HTMLElement).style.border = '1px solid #bfdbfe';
      (e.currentTarget as HTMLElement).style.color = '#2563eb';
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
  const [bayarTipe, setBayarTipe] = useState('DP');
  const [bayarJumlah, setBayarJumlah] = useState('');
  const [bayarTanggal, setBayarTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [bayarCatatan, setBayarCatatan] = useState('');
  const [sjTanggal, setSjTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sjCatatan, setSjCatatan] = useState('');
  const [sjItems, setSjItems] = useState<Record<number, number>>({});
  const [invIntTanggal, setInvIntTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [invIntSjId, setInvIntSjId] = useState<number | ''>('');
  const [invIntCatatan, setInvIntCatatan] = useState('');

  // Retur state
  const [returModal, setReturModal] = useState<{ open: boolean; sj: SuratJalanInteriorData | null }>({ open: false, sj: null });
  const [returForm, setReturForm] = useState<{
    tanggal: string;
    catatan: string;
    items: Array<{ penjualan_interior_item_id: number; nama_barang: string; qty_kirim: number; qty_retur: number | '' }>;
  }>({ tanggal: new Date().toISOString().split('T')[0], catatan: '', items: [] });
  const [returLoading, setReturLoading] = useState(false);

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
    setDocLoading(true);
    try {
      await api.post(`/penjualan-interior/${id}/proforma`, { tanggal: proformaTanggal, catatan: proformaCatatan });
      toast.success('Proforma Invoice berhasil dibuat!');
      setModal(null); fetchData();
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
    if (!invIntSjId) { toast.error('Pilih Surat Jalan terlebih dahulu'); return; }
    setDocLoading(true);
    try {
      await api.post(`/penjualan-interior/${id}/invoice`, {
        tanggal: invIntTanggal, surat_jalan_interior_id: invIntSjId, catatan: invIntCatatan,
      });
      toast.success('Invoice Interior berhasil dibuat!');
      setModal(null); fetchData();
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
      await api.post(`/penjualan-interior/${id}/retur-sj`, {
        surat_jalan_interior_id: returModal.sj?.id,
        tanggal: returForm.tanggal,
        catatan: returForm.catatan,
        items: returForm.items
          .filter(i => Number(i.qty_retur) > 0)
          .map(i => ({ penjualan_interior_item_id: i.penjualan_interior_item_id, qty_retur: Number(i.qty_retur) })),
      });
      toast.success('Retur berhasil dicatat!');
      setReturModal({ open: false, sj: null });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan retur');
    } finally {
      setReturLoading(false);
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
            data.status === 'COMPLETED' ? { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' } :
            { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }
          }
        >
          {data.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer info */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Identitas Customer</h2>
              {canEditIdentitas && (
                <button
                  onClick={openIdentitasModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#dbeafe'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
                >
                  <Pencil className="h-3 w-3" /> Edit Identitas
                </button>
              )}
            </div>
            <div className="space-y-3">
              <InfoRow label="Nama Customer" value={data.nama_customer} />
              <InfoRow label="PT / NPWP" value={data.nama_pt_npwp} />
              <InfoRow label="No. HP" value={data.no_hp} />
              <InfoRow label="Faktur" value={data.faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'} />
              {data.no_npwp && <InfoRow label="No. NPWP" value={data.no_npwp} />}
              {!!data.pakai_ppn && <InfoRow label="PPN" value={`${data.ppn_persen}%`} />}
            </div>
          </div>

          {/* Produk */}
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
                    <td className="px-5 py-3 text-base font-black text-right" style={{ color: '#2563eb' }}>{formatRupiah(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pembayaran */}
          {data.pembayarans?.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <CreditCard className="h-4 w-4" style={{ color: '#94a3b8' }} />
                <h2 className="text-sm font-bold" style={{ color: '#1e293b' }}>Riwayat Pembayaran</h2>
              </div>
              <table className="w-full">
                <tbody>
                  {data.pembayarans.map((p: any, idx: number) => (
                    <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f8fafc' }}>
                      <td className="px-5 py-3 text-sm" style={{ color: '#64748b' }}>{formatDate(p.tanggal)}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {p.tipe.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-right" style={{ color: '#059669' }}>{formatRupiah(p.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td colSpan={2} className="px-5 py-3 text-sm font-bold" style={{ color: '#475569' }}>Total Terbayar</td>
                    <td className="px-5 py-3 text-right font-black" style={{ color: '#059669' }}>{formatRupiah(totalBayar)}</td>
                  </tr>
                  {sisa > 0 && (
                    <tr style={{ background: '#fef9f0' }}>
                      <td colSpan={2} className="px-5 py-2.5 text-sm font-semibold" style={{ color: '#92400e' }}>Sisa Tagihan</td>
                      <td className="px-5 py-2.5 text-right font-black" style={{ color: '#c2410c' }}>{formatRupiah(sisa)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Right panel — dokumen */}
        <div className="space-y-4">
          {/* Aksi */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: '#1e293b' }}>Buat Dokumen</h2>
            <div className="space-y-2">
              <ActionButton onClick={() => setModal('proforma')} icon={FileText} label="Proforma Invoice" desc="Tagihan ke customer" />
              <ActionButton onClick={() => setModal('sj')} icon={Truck} label="Surat Jalan" desc="Dokumen pengiriman (partial)" />
              <ActionButton onClick={() => setModal('invoice-interior')} icon={Receipt} label="Invoice Interior" desc="Invoice berdasarkan SJ" />
              <ActionButton onClick={() => setModal('pembayaran')} icon={CreditCard} label="Tambah Pembayaran" desc="Catat pembayaran masuk" />
            </div>
          </div>

          {/* Proforma list */}
          {data.proformas?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Proforma Invoice</h3>
              </div>
              <div className="space-y-2">
                {data.proformas.map((p: any) => (
                  <DocItem key={p.id} nomor={p.nomor_proforma} sub={`${formatDate(p.tanggal)} · ${formatRupiah(p.total)}`}
                    onPrint={() => printDoc('proforma', p.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Surat Jalan list */}
          {data.suratJalans?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Surat Jalan</h3>
              </div>
              <div className="space-y-3">
                {data.suratJalans.map((sj: any) => (
                  <div key={sj.id} className="space-y-2">
                    {/* SJ card with print + retur buttons */}
                    <div
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
                    >
                      <div>
                        <div className="text-xs font-mono font-medium" style={{ color: '#334155' }}>{sj.nomor_surat}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatDate(sj.tanggal)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => printDoc('surat-jalan-interior', sj.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#eff6ff';
                            (e.currentTarget as HTMLElement).style.color = '#2563eb';
                            (e.currentTarget as HTMLElement).style.border = '1px solid #bfdbfe';
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
                        <button
                          onClick={() => openReturModal(sj)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#fff7ed';
                            (e.currentTarget as HTMLElement).style.color = '#c2410c';
                            (e.currentTarget as HTMLElement).style.border = '1px solid #fed7aa';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = '#fff';
                            (e.currentTarget as HTMLElement).style.color = '#475569';
                            (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Retur
                        </button>
                      </div>
                    </div>

                    {/* Retur history for this SJ */}
                    {sj.returs?.length > 0 && (
                      <div className="ml-2 space-y-1.5">
                        <div className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: '#c2410c' }}>
                          Riwayat Retur
                        </div>
                        {sj.returs.map((retur: any) => {
                          const sjItem = sj.items?.find((i: any) => i.penjualan_interior_item_id === retur.penjualan_interior_item_id);
                          const namaBarang = sjItem?.item?.nama_barang || '-';
                          return (
                            <div
                              key={retur.id}
                              className="p-2.5 rounded-lg text-xs"
                              style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate" style={{ color: '#92400e' }}>{namaBarang}</span>
                                <span className="flex-shrink-0 font-bold px-2 py-0.5 rounded-full" style={{ background: '#bfdbfe', color: '#be123c' }}>
                                  -{retur.qty_retur} unit
                                </span>
                              </div>
                              <div className="mt-1" style={{ color: '#b45309' }}>{formatDate(retur.tanggal)}</div>
                              {retur.catatan && (
                                <div className="mt-0.5 italic" style={{ color: '#b45309' }}>{retur.catatan}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Interior list */}
          {data.invoices?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Invoice</h3>
              </div>
              <div className="space-y-2">
                {data.invoices.map((inv: any) => (
                  <DocItem key={inv.id} nomor={inv.nomor_invoice} sub={formatDate(inv.tanggal)}
                    onPrint={() => printDoc('invoice-interior', inv.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Proforma ── */}
      <ModalWrapper show={modal === 'proforma'} onClose={() => setModal(null)}>
        <ModalHeader icon={FileText} title="Buat Proforma Invoice" sub="Tagihan awal ke customer interior" />
        <div className="space-y-4">
          <ModalInput label="Tanggal" type="date" value={proformaTanggal} onChange={(e: any) => setProformaTanggal(e.target.value)} />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Catatan (opsional)</label>
            <textarea value={proformaCatatan} onChange={e => setProformaCatatan(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
        </div>
        <ModalFooter onClose={() => setModal(null)} onSubmit={createProforma} loading={docLoading} label="Buat Proforma" />
      </ModalWrapper>

      {/* ── Modal Pembayaran ── */}
      <ModalWrapper show={modal === 'pembayaran'} onClose={() => setModal(null)}>
        <ModalHeader icon={CreditCard} title="Tambah Pembayaran" sub="Catat pembayaran dari customer" />
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Tipe Pembayaran</label>
            <select value={bayarTipe} onChange={e => setBayarTipe(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}>
              {PEMBAYARAN_TIPE.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <ModalInput label="Jumlah (Rp)" type="number" value={bayarJumlah} onChange={(e: any) => setBayarJumlah(e.target.value)} placeholder="0" />
          <ModalInput label="Tanggal" type="date" value={bayarTanggal} onChange={(e: any) => setBayarTanggal(e.target.value)} />
          <ModalInput label="Catatan (opsional)" value={bayarCatatan} onChange={(e: any) => setBayarCatatan(e.target.value)} />
        </div>
        <ModalFooter onClose={() => setModal(null)} onSubmit={createPembayaran} loading={docLoading} label="Simpan" />
      </ModalWrapper>

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
      <ModalWrapper show={modal === 'invoice-interior'} onClose={() => setModal(null)}>
        <ModalHeader icon={Receipt} title="Buat Invoice Interior" sub="Invoice berdasarkan Surat Jalan yang ada" />
        <div className="space-y-4">
          <ModalInput label="Tanggal Invoice" type="date" value={invIntTanggal} onChange={(e: any) => setInvIntTanggal(e.target.value)} />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Surat Jalan Referensi</label>
            <select value={invIntSjId} onChange={e => setInvIntSjId(Number(e.target.value) || '')}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}>
              <option value="">— Pilih Surat Jalan —</option>
              {data.suratJalans?.map((sj: any) => (
                <option key={sj.id} value={sj.id}>{sj.nomor_surat} ({formatDate(sj.tanggal)})</option>
              ))}
            </select>
          </div>
          <ModalInput label="Catatan (opsional)" value={invIntCatatan} onChange={(e: any) => setInvIntCatatan(e.target.value)} />
        </div>
        <ModalFooter onClose={() => setModal(null)} onSubmit={createInvoiceInterior} loading={docLoading} label="Buat Invoice" />
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
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
        </div>
        <ModalFooter onClose={() => setReturModal({ open: false, sj: null })} onSubmit={handleSubmitRetur} loading={returLoading} label="Simpan Retur" />
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <Pencil className="h-5 w-5" style={{ color: '#2563eb' }} />
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
                    onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
                    onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setIdentitasModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>
                Batal
              </button>
              <button onClick={saveIdentitas} disabled={identitasLoading || !identitasForm.nama_customer} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                {identitasLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
