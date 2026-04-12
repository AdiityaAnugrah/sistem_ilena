'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupiah } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

export default function PenjualanInteriorBaru() {
  const router = useRouter();
  const [faktur, setFaktur] = useState<'FAKTUR' | 'NON_FAKTUR'>('FAKTUR');
  const [pakaiPPN, setPakaiPPN] = useState(false);
  const [ppnPersen, setPpnPersen] = useState<'10' | '11'>('11');
  const [items, setItems] = useState<any[]>([{ kode_barang: '', nama_barang: '', qty: 1, harga_satuan: 0 }]);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const addItem = () => setItems(prev => [...prev, { kode_barang: '', nama_barang: '', qty: 1, harga_satuan: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const getSubtotal = (item: any) => item.qty * item.harga_satuan;
  const subtotalTotal = items.reduce((s, i) => s + getSubtotal(i), 0);
  const ppnValue = pakaiPPN ? subtotalTotal * (parseInt(ppnPersen) / 100) : 0;
  const grandTotal = subtotalTotal + ppnValue;

  const onSubmit = async (formData: any) => {
    const validItems = items.filter(i => i.nama_barang && i.qty > 0 && i.harga_satuan > 0);
    if (validItems.length === 0) { toast.error('Minimal 1 item valid wajib diisi'); return; }
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Penjualan Interior Baru</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Jenis */}
        <Card>
          <CardHeader><CardTitle className="text-base">Jenis Transaksi</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <div>
              <Label className="text-xs mb-1 block">Faktur</Label>
              <div className="flex gap-2">
                {(['FAKTUR', 'NON_FAKTUR'] as const).map(f => (
                  <button key={f} type="button"
                    onClick={() => setFaktur(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      faktur === f ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                    {f === 'FAKTUR' ? 'Faktur Pajak' : 'Non Faktur'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2 mb-0.5">
                <input type="checkbox" id="ppn" checked={pakaiPPN} onChange={e => setPakaiPPN(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="ppn" className="text-sm font-medium cursor-pointer">Pakai PPN</label>
              </div>
              {pakaiPPN && (
                <div className="flex gap-2">
                  {(['10', '11'] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => setPpnPersen(p)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        ppnPersen === p ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700'
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
        <Card>
          <CardHeader><CardTitle className="text-base">Identitas Customer</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>No. PO *</Label>
              <Input {...register('no_po', { required: true })} placeholder="Nomor Purchase Order" />
              {errors.no_po && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>Tanggal *</Label>
              <Input type="date" {...register('tanggal', { required: true })} />
              {errors.tanggal && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>Nama Customer *</Label>
              <Input {...register('nama_customer', { required: true })} placeholder="Nama customer" />
              {errors.nama_customer && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>No. HP *</Label>
              <Input {...register('no_hp', { required: true })} placeholder="08xx" />
              {errors.no_hp && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>Nama PT / NPWP *</Label>
              <Input {...register('nama_pt_npwp', { required: true })} placeholder="Nama perusahaan / a.n. NPWP" />
              {errors.nama_pt_npwp && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>No. NPWP</Label>
              <Input {...register('no_npwp')} placeholder="xx.xxx.xxx.x-xxx.xxx (opsional)" />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                 <CardTitle className="text-lg font-bold text-slate-800">Daftar Barang</CardTitle>
                 <p className="text-xs text-slate-500 mt-0.5">Tambah baris barang untuk PO Interior ini</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="shadow-sm">
                + Tambah Baris
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto border border-[#e2e8f0] rounded-2xl shadow-sm">
              <table className="w-full text-sm min-w-[750px]">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="text-left py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-32">Kode</th>
                    <th className="text-left py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase">Nama Barang</th>
                    <th className="text-center py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-24">Qty</th>
                    <th className="text-right py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-48">Harga Satuan</th>
                    <th className="text-right py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-40">Subtotal</th>
                    <th className="py-3.5 px-5 w-14"></th>
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
                        <Input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} className="w-full h-9 text-center focus:ring-red-200 border-slate-200" />
                      </td>
                      <td className="py-3 px-5">
                         <div className="relative flex items-center shadow-sm rounded-lg">
                           <div className="absolute left-3 text-slate-400 font-bold text-sm pointer-events-none">Rp</div>
                           <input
                             type="number" value={item.harga_satuan || ''} onChange={e => updateItem(idx, 'harga_satuan', Number(e.target.value))}
                             className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-bold text-slate-700"
                           />
                         </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                         <div className="font-bold text-slate-800 tracking-tight text-[15px]">
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
                <tfoot className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-4 px-5 text-right text-slate-600 font-semibold tracking-wide">Subtotal:</td>
                    <td className="py-4 px-5 text-right font-bold text-slate-800">{formatRupiah(subtotalTotal)}</td>
                    <td></td>
                  </tr>
                  {pakaiPPN && (
                    <tr className="border-t border-slate-200/50">
                      <td colSpan={4} className="py-3 px-5 text-right text-slate-500 font-medium">PPN {ppnPersen}%:</td>
                      <td className="py-3 px-5 text-right font-medium text-slate-700">{formatRupiah(ppnValue)}</td>
                      <td></td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200">
                    <td colSpan={4} className="py-5 px-5 text-right text-slate-800 font-bold tracking-wide">TOTAL:</td>
                    <td className="py-5 px-5 text-right font-black text-red-600 text-lg tracking-tight">{formatRupiah(grandTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </div>
  );
}
