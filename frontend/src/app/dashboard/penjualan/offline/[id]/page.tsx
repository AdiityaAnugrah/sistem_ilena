'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, Receipt, FilePlus, Printer,
  User, Phone, MapPin, Hash, Calendar, Package, ShoppingCart, Pencil, AlertTriangle
} from 'lucide-react';
import useAuthStore from '@/store/authStore';

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
  </div>
);

// ─── Modal Buat Dokumen ──────────────────────────────────────────────────────
const DocModal = ({
  show, title, onClose, onSubmit, loading,
  tanggal, setTanggal, catatan, setCatatan,
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
            style={{ background: '#eff6ff' }}
          >
            <FileText className="h-5 w-5" style={{ color: '#2563eb' }} />
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
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
              onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
            />
          </div>
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
              onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
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
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 12px rgba(244,63,94,0.3)' }}
          >
            {loading ? 'Membuat...' : 'Buat Dokumen'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Proses Jual Multiple Item Display ──────────────────────────────────────────────
const JualMultipleModal = ({
  show, items, onClose, onSubmit, loading,
  form, setForm
}: any) => {
  if (!show || !items) return null;
  const updateForm = (id: number, field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const totalQty = Object.values(form).reduce((sum: number, f: any) => sum + (f.qty || 0), 0);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div 
        className="w-full max-w-2xl rounded-2xl p-6 animate-fade-in max-h-[90vh] flex flex-col"
        style={{ background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ecfdf5' }}>
            <ShoppingCart className="h-5 w-5" style={{ color: '#10b981' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: '#0f172a' }}>Proses Penjualan Display</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Tentukan barang mana saja beserta jumlah yang laku</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 pr-2" style={{ maxHeight: '50vh' }}>
          <div className="space-y-3">
            {items.map((item: any) => {
              const f = form[item.id] || { qty: 0, harga: '' };
              const isSelected = f.qty > 0;
              return (
                <div key={item.id} className="p-4 rounded-xl border flex items-center gap-4 transition-all" style={{ background: isSelected ? '#ecfdf5' : '#f8fafc', borderColor: isSelected ? '#a7f3d0' : '#f1f5f9' }}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: '#1e293b' }}>{item.barang?.nama || item.barang_id}</div>
                    <div className="text-xs mt-1 text-slate-500">
                      Sisa Display: <span className="font-bold text-slate-700">{item.qty}</span> &nbsp;|&nbsp; Harga Ori: <span className="text-slate-700">{formatRupiah(item.harga_satuan)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-24">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Qty Laku</label>
                      <input 
                        type="number" min="0" max={item.qty} value={f.qty === 0 ? '' : f.qty} 
                        onChange={e => updateForm(item.id, 'qty', Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm rounded-lg outline-none transition-all"
                        style={{ border: '1px solid #cbd5e1', background: '#fff' }}
                        placeholder="0"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Harga Baru (Opsional)</label>
                      <input 
                        type="number" value={f.harga === 0 ? '' : f.harga} 
                        onChange={e => updateForm(item.id, 'harga', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg outline-none transition-all"
                        style={{ border: '1px solid #cbd5e1', background: '#fff' }}
                        placeholder={item.harga_satuan}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all text-slate-600 bg-slate-100 hover:bg-slate-200"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || totalQty === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}
          >
            {loading ? 'Memproses...' : `Proses ${totalQty} Barang Terpilih`}
          </button>
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
  const [jualForm, setJualForm] = useState<Record<number, { qty: number; harga: string }>>({});
  const [jualLoading, setJualLoading] = useState(false);

  const openJualModal = () => {
    const initForm: any = {};
    data.items.forEach((it: any) => {
      initForm[it.id] = { qty: 0, harga: '' };
    });
    setJualForm(initForm);
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
      await api.post(`/penjualan-offline/${id}/${type}`, { tanggal: docTanggal, catatan: docCatatan });
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
          harga_jual: f.harga !== '' ? Number(f.harga) : baseItem?.harga_satuan,
          diskon: baseItem?.diskon || 0
        };
      }
      return null;
    }).filter(Boolean);

    if (selectedItems.length === 0) return;

    setJualLoading(true);
    try {
      const res = await api.post(`/penjualan-offline/${id}/proses-jual-item`, { items: selectedItems });
      
      const newPenjualanId = res.data.new_penjualan_id;
      toast.success(
        (t) => (
          <span>
            Barang display berhasil diproses jadi terjual! 
            <button 
              onClick={() => { toast.dismiss(t.id); router.push(`/dashboard/penjualan/offline/${newPenjualanId}`); }} 
              className="ml-2 font-bold underline text-blue-600 dark:text-blue-400"
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
            {formatDate(data.tanggal)} · {data.faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}
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
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#dbeafe'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
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
              {!isPenjualan && data.items?.length > 0 && (
                <button
                  onClick={openJualModal}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Pilih & Proses Barang Terjual
                </button>
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
                    <td className="px-5 py-3.5 text-base font-black text-right" style={{ color: '#2563eb' }}>
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
              <div className="space-y-2">
                {data.suratPengantars.map((sp: any) => (
                  <DocItem
                    key={sp.id}
                    nomor={sp.nomor_sp}
                    tanggal={sp.tanggal}
                    onPrint={() => printDoc('sp', sp.id)}
                  />
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
      />
      <DocModal
        show={spModal} title="Buat Surat Pengantar"
        onClose={closeAllModals} onSubmit={() => createDoc('surat-pengantar')}
        loading={docLoading} tanggal={docTanggal} setTanggal={setDocTanggal}
        catatan={docCatatan} setCatatan={setDocCatatan}
      />
      <JualMultipleModal
        show={jualModal} items={data.items}
        onClose={() => setJualModal(false)}
        onSubmit={prosesJualItem} loading={jualLoading}
        form={jualForm} setForm={setJualForm}
      />

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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <Pencil className="h-5 w-5" style={{ color: '#2563eb' }} />
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
              <button onClick={saveIdentitas} disabled={identitasLoading || !identitasForm.nama_penerima} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                {identitasLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
