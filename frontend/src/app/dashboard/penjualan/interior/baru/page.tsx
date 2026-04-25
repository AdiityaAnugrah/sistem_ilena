'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/DateInput';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupiah } from '@/lib/utils';
import { Trash2, Plus, LayoutPanelTop, User, ClipboardList, Wallet2, MapPin } from 'lucide-react';
import TutorialVideoModal from '@/components/TutorialVideoModal';
import AlamatForm from '@/components/forms/AlamatForm';

export default function PenjualanInteriorBaru() {
  const router = useRouter();
  const [faktur, setFaktur] = useState<'FAKTUR' | 'NON_FAKTUR'>('FAKTUR');
  const [pakaiPPN, setPakaiPPN] = useState(false);
  const [ppnPersen, setPpnPersen] = useState<'10' | '11'>('11');
  const [items, setItems] = useState<any[]>([{ kode_barang: '', nama_barang: '', qty: 1, harga_satuan: 0 }]);
  const [loading, setLoading] = useState(false);
  const [alamat, setAlamat] = useState({
    provinsi_id: null as number | null,
    kabupaten_id: null as number | null,
    kecamatan_id: null as number | null,
    kelurahan_id: null as number | null,
    detail: '',
    kode_pos: '',
  });
  const [tutorial, setTutorial] = useState<{ youtube_url: string; start_second: number; end_second: number | null } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingData = useRef<any>(null);

  useEffect(() => {
    api.get('/tutorial-video/PENJUALAN_INTERIOR')
      .then(r => { if (r.data?.active) setTutorial(r.data); })
      .catch(() => {});
  }, []);
  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    defaultValues: { tanggal: new Date().toISOString().split('T')[0] },
  });

  const addItem = () => setItems(prev => [...prev, { kode_barang: '', nama_barang: '', qty: 1, harga_satuan: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const getSubtotal = (item: any) => item.qty * item.harga_satuan;
  const subtotalTotal = items.reduce((s, i) => s + getSubtotal(i), 0);
  const ppnValue = pakaiPPN ? subtotalTotal * (parseInt(ppnPersen) / 100) : 0;
  const grandTotal = subtotalTotal + ppnValue;

  const onSubmit = (formData: any) => {
    const validItems = items.filter(i => i.nama_barang && i.qty > 0 && i.harga_satuan > 0);
    if (validItems.length === 0) { toast.error('Minimal 1 item valid wajib diisi'); return; }
    pendingData.current = formData;
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    const formData = pendingData.current;
    const validItems = items.filter(i => i.nama_barang && i.qty > 0 && i.harga_satuan > 0);
    setConfirmOpen(false);
    setLoading(true);
    try {
      const payload = {
        faktur,
        no_po: formData.no_po,
        nama_customer: formData.nama_customer,
        nama_pt_npwp: formData.nama_pt_npwp,
        no_hp: formData.no_hp,
        no_npwp: formData.no_npwp || null,
        pakai_ppn: pakaiPPN,
        ppn_persen: pakaiPPN ? ppnPersen : null,
        tanggal: formData.tanggal,
        alamat_provinsi_id: alamat.provinsi_id,
        alamat_kabupaten_id: alamat.kabupaten_id,
        alamat_kecamatan_id: alamat.kecamatan_id,
        alamat_kelurahan_id: alamat.kelurahan_id,
        alamat_detail: alamat.detail || null,
        alamat_kode_pos: alamat.kode_pos || null,
        items: validItems,
      };
      const res = await api.post('/penjualan-interior', payload);
      toast.success('Penjualan interior berhasil dibuat!');
      router.push(`/dashboard/penjualan/interior/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat penjualan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-200 ring-4 ring-red-50">
            <LayoutPanelTop className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight">Penjualan Interior Baru</h1>
            <p className="text-xs lg:text-sm text-slate-500 font-medium">Buat pesanan desain dan pengerjaan interior baru</p>
          </div>
        </div>
        {tutorial && (
          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #e2e8f0', backgroundColor: '#fff',
              color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            🎬 Tutorial
          </button>
        )}
      </div>
      {tutorial && (
        <TutorialVideoModal
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
          youtubeUrl={tutorial.youtube_url}
          startSecond={tutorial.start_second}
          endSecond={tutorial.end_second ?? undefined}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Jenis */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <Wallet2 className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Jenis Transaksi</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-8 p-6">
            <div className="space-y-2.5">
              <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Jenis Faktur</Label>
              <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl w-fit">
                {(['FAKTUR', 'NON_FAKTUR'] as const).map(f => (
                  <button key={f} type="button"
                    onClick={() => setFaktur(f)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      faktur === f ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-6">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all hover:border-red-200 group">
                <input type="checkbox" id="ppn" checked={pakaiPPN} onChange={e => setPakaiPPN(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                <label htmlFor="ppn" className="text-sm font-semibold text-slate-700 cursor-pointer select-none group-hover:text-red-700">Gunakan PPN</label>
              </div>
              
              {pakaiPPN && (
                <div className="flex gap-1.5 p-1 bg-green-50 rounded-xl border border-green-100 animate-in fade-in zoom-in duration-200">
                  {(['10', '11'] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => setPpnPersen(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        ppnPersen === p ? 'bg-green-600 text-white shadow-sm' : 'text-green-700 hover:bg-green-100'
                      }`}>
                      PPN {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Identitas */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <User className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Identitas Customer</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nomor PO *</Label>
              <Input
                {...register('no_po', { required: 'No. PO wajib diisi' })}
                placeholder="Purchase Order #"
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.no_po && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.no_po.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Tanggal Transaksi *</Label>
              <DateInput
                {...register('tanggal', { required: 'Tanggal wajib diisi' })}
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.tanggal && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.tanggal.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nama Customer *</Label>
              <Input
                {...register('nama_customer', {
                  required: 'Nama customer wajib diisi',
                  minLength: { value: 2, message: 'Minimal 2 karakter' },
                })}
                placeholder="Nama lengkap customer"
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.nama_customer && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.nama_customer.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nomor WhatsApp *</Label>
              <Input
                {...register('no_hp', {
                  required: 'Nomor HP wajib diisi',
                  pattern: { value: /^0\d{9,12}$/, message: 'Mulai dengan 0, 10–13 digit' },
                })}
                inputMode="numeric"
                maxLength={13}
                onBeforeInput={(e: any) => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault(); }}
                placeholder="0812..."
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.no_hp && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.no_hp.message as string}</p>}
            </div>
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-xs font-bold text-slate-500 ml-1">Perusahaan / Nama PT *</Label>
              <Input
                {...register('nama_pt_npwp', {
                  required: 'Nama PT / NPWP wajib diisi',
                  minLength: { value: 2, message: 'Minimal 2 karakter' },
                })}
                placeholder="Nama Perusahaan"
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.nama_pt_npwp && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.nama_pt_npwp.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nomor NPWP / NIK</Label>
              <Input
                {...register('no_npwp')}
                placeholder="00.000.000.0-000.000 (Opsional)"
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Alamat Pengiriman */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <MapPin className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Alamat Pengiriman</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <AlamatForm label="" value={alamat} onChange={setAlamat} />
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600 shadow-inner">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base lg:text-lg font-bold text-slate-800 tracking-tight">Daftar Barang</CardTitle>
                  <p className="text-[11px] lg:text-xs text-slate-500 font-medium mt-0.5">Kelola item produk dalam pesanan ini</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-9 px-4 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-red-600 transition-all font-bold gap-2 text-xs shadow-sm active:scale-95">
                <Plus className="w-4 h-4" /> Tambah Baris
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto border border-[#e2e8f0] rounded-2xl shadow-sm">
              <table className="w-full text-sm min-w-[750px]">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="text-left py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-32">Kode</th>
                    <th className="text-left py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase">Nama Barang</th>
                    <th className="text-center py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-24">Qty</th>
                    <th className="text-right py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-48">Harga Satuan</th>
                    <th className="text-right py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-40">Subtotal</th>
                    <th className="py-3 px-5 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-5">
                        <Input value={item.kode_barang} onChange={e => updateItem(idx, 'kode_barang', e.target.value)} placeholder="Kode" className="h-9 focus:ring-red-200 border-slate-200" />
                      </td>
                      <td className="py-3 px-5">
                        <Input value={item.nama_barang} onChange={e => updateItem(idx, 'nama_barang', e.target.value)} placeholder="Nama barang" className="h-9 focus:ring-red-200 border-slate-200" />
                      </td>
                      <td className="py-3 px-5 text-center">
                        <Input
                          type="number" min={1} step={1} value={item.qty}
                          onChange={e => updateItem(idx, 'qty', Math.max(1, Math.floor(Number(e.target.value))))}
                          onBeforeInput={(e: any) => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault(); }}
                          className="w-full h-9 text-center focus:ring-red-200 border-slate-200"
                        />
                      </td>
                      <td className="py-3 px-5">
                         <div className="relative flex items-center shadow-sm rounded-lg">
                           <div className="absolute left-3 text-slate-400 font-bold text-sm pointer-events-none">Rp</div>
                           <input
                             type="number" min={0} value={item.harga_satuan || ''}
                             onChange={e => updateItem(idx, 'harga_satuan', Math.max(0, Number(e.target.value)))}
                             onBeforeInput={(e: any) => { if (e.data && !/[\d.]/.test(e.data)) e.preventDefault(); }}
                             className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-semibold text-slate-700"
                           />
                         </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                         <div className="font-semibold text-slate-800 tracking-tight text-[14px] lg:text-[15px]">
                            {formatRupiah(getSubtotal(item))}
                         </div>
                      </td>
                      <td className="py-3 px-5 text-center">
                        <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shadow-sm disabled:opacity-30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200">
                    <td colSpan={4} className="py-4 px-6 text-right text-slate-500 font-bold uppercase tracking-wider text-[10px]">Subtotal (Hanya Barang)</td>
                    <td className="py-4 px-6 text-right font-bold text-slate-800 text-sm">{formatRupiah(subtotalTotal)}</td>
                    <td></td>
                  </tr>
                  {pakaiPPN && (
                    <tr className="border-t border-slate-200/50 bg-slate-50/30">
                      <td colSpan={4} className="py-3 px-6 text-right text-green-600/70 font-bold uppercase tracking-wider text-[10px]">PPN Terlampir {ppnPersen}%</td>
                      <td className="py-3 px-6 text-right font-bold text-green-700 text-sm">{formatRupiah(ppnValue)}</td>
                      <td></td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-200 bg-white">
                    <td colSpan={4} className="py-6 px-6 text-right text-slate-800 font-black uppercase tracking-widest text-[11px]">Total Akhir Penjualan</td>
                    <td className="py-6 px-6 text-right font-black text-red-600 text-lg lg:text-xl tracking-tight leading-none">{formatRupiah(grandTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end items-center gap-4 pt-4">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="h-11 px-6 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all">
            Batalkan
          </Button>
          <Button type="submit" disabled={loading} className="h-11 px-10 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-black shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-[1.02] transition-all disabled:opacity-50">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </div>
            ) : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-bold mb-1" style={{ color: '#0f172a' }}>Konfirmasi Simpan</h3>
              <p className="text-sm" style={{ color: '#64748b' }}>
                Apakah data sudah benar? Penjualan akan disimpan dan tidak dapat dihapus.
              </p>
              <div className="mt-3 rounded-xl p-3 space-y-1 text-xs" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="flex justify-between"><span style={{ color: '#94a3b8' }}>Tipe</span><span className="font-semibold" style={{ color: '#334155' }}>Interior — {faktur === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}{pakaiPPN ? ` + PPN ${ppnPersen}%` : ''}</span></div>
                <div className="flex justify-between"><span style={{ color: '#94a3b8' }}>Item</span><span className="font-semibold" style={{ color: '#334155' }}>{items.filter(i => i.nama_barang && i.qty > 0 && i.harga_satuan > 0).length} item</span></div>
                <div className="flex justify-between"><span style={{ color: '#94a3b8' }}>Grand Total</span><span className="font-bold" style={{ color: '#FA2F2F' }}>{formatRupiah(grandTotal)}</span></div>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all" style={{ background: '#f1f5f9', color: '#475569' }}>
                Periksa Lagi
              </button>
              <button onClick={doSubmit} disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#FA2F2F,#d41a1a)' }}>
                {loading ? 'Menyimpan...' : 'Ya, Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
