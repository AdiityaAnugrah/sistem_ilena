'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/DateInput';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AlamatForm from '@/components/forms/AlamatForm';
import BarangSelector from '@/components/forms/BarangSelector';
import { formatRupiah } from '@/lib/utils';
import { Trash2, PackageOpen, User, MapPin, Truck, Wallet2, ShoppingCart } from 'lucide-react';

const emptyAlamat = { provinsi_id: null as number | null, kabupaten_id: null as number | null, kecamatan_id: null as number | null, kelurahan_id: null as number | null, detail: '', kode_pos: '' };

export default function PenjualanOnlineBaru() {
  const router = useRouter();
  const [faktur, setFaktur] = useState<'FAKTUR' | 'NON_FAKTUR'>('NON_FAKTUR');
  const [channel, setChannel] = useState('SHOPEE');
  const [metode, setMetode] = useState('MARKETPLACE');
  const [kurangiStok, setKurangiStok] = useState(true);
  const [alamat, setAlamat] = useState(emptyAlamat);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>({ defaultValues: { tanggal: new Date().toISOString().split('T')[0], ongkir: 0, biaya_lain: 0, diskon_order: 0 } });

  const addItem = (barang: any) => {
    let varianList: any[] = [];
    try { varianList = barang.varian ? JSON.parse(barang.varian) : []; } catch { varianList = []; }
    varianList = varianList.filter((v: any) => v.nama && v.nama.trim() !== '');
    const defaultVarian = varianList[0] || null;
    if (items.find(i => i.barang_id === barang.id && i.varian_id === (defaultVarian?.id || null))) { toast.error('Produk dan varian ini sudah ditambahkan'); return; }
    const harga = Number(barang.harga_ilena ?? barang.harga ?? 0);
    setItems(prev => [...prev, { barang_id: barang.id, nama: barang.nama, varian_list: varianList, varian_nama: defaultVarian?.nama || null, varian_id: defaultVarian?.id || null, qty: 1, harga_satuan: harga, diskon: barang.diskon_efektif ?? 0 }]);
  };
  const updateItem = (idx:number, field:string, val:any) => setItems(prev => prev.map((item,i) => i === idx ? { ...item, [field]: val } : item));
  const removeItem = (idx:number) => setItems(prev => prev.filter((_,i) => i !== idx));
  const subtotalProduk = items.reduce((s,i) => s + Number(i.qty || 0) * Number(i.harga_satuan || 0) * (1 - Math.max(0, Number(i.diskon || 0)) / 100), 0);
  const ongkir = Number(watch('ongkir') || 0); const biayaLain = Number(watch('biaya_lain') || 0); const diskonOrder = Number(watch('diskon_order') || 0);
  const grandTotal = Math.max(0, subtotalProduk + ongkir + biayaLain - diskonOrder);

  const onSubmit = async (form: any) => {
    if (items.length === 0) { toast.error('Minimal 1 produk wajib ditambahkan'); return; }
    if (!alamat.detail.trim()) { toast.error('Detail alamat wajib diisi'); return; }
    setLoading(true);
    try {
      const payload = {
        id_pesanan: form.id_pesanan, faktur, channel, nama_pelanggan: form.nama_pelanggan, no_hp: form.no_hp,
        metode_pembayaran: metode,
        tanggal: form.tanggal, provinsi_id: alamat.provinsi_id, kabupaten_id: alamat.kabupaten_id,
        kecamatan_id: alamat.kecamatan_id, kelurahan_id: alamat.kelurahan_id, alamat_detail: alamat.detail,
        kode_pos: alamat.kode_pos || null, ongkir: form.ongkir || 0, biaya_lain: form.biaya_lain || 0,
        diskon_order: form.diskon_order || 0, kurangi_stok: kurangiStok, catatan: form.catatan || null,
        items: items.map(i => ({ barang_id: i.barang_id, varian_nama: i.varian_nama, varian_id: i.varian_id, qty: Number(i.qty), harga_satuan: Number(i.harga_satuan), diskon: Number(i.diskon || 0) })),
      };
      const res = await api.post('/penjualan-online', payload);
      toast.success('Penjualan online berhasil dibuat');
      router.push(`/dashboard/penjualan/online/${res.data.id}`);
    } catch (err:any) { toast.error(err.response?.data?.message || 'Gagal membuat penjualan online'); }
    finally { setLoading(false); }
  };

  return <div className="max-w-6xl mx-auto animate-fade-in pb-12">
    <div className="mb-8 flex items-center gap-4"><div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-200 ring-4 ring-red-50"><ShoppingCart className="w-6 h-6 text-white" /></div><div><h1 className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight">Penjualan Online Baru</h1><p className="text-xs lg:text-sm text-slate-500 font-medium">Input pesanan marketplace / website / sosial media</p></div></div>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="border-0 shadow-sm bg-white ring-1 ring-slate-200/60"><CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9]"><CardTitle className="flex items-center gap-2 text-base"><Wallet2 className="w-4 h-4"/>Informasi Pesanan</CardTitle></CardHeader><CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><Label>ID Pesanan *</Label><Input {...register('id_pesanan', { required: true })} placeholder="Contoh: 250908ABC123" />{errors.id_pesanan && <p className="text-xs text-red-500 mt-1">ID Pesanan wajib diisi</p>}</div>
        <div><Label>Tanggal *</Label><DateInput {...register('tanggal', { required: true })} className="w-full h-10 px-3 rounded-md border" /></div>
        <div><Label>Channel</Label><select value={channel} onChange={e => setChannel(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-white text-sm">{['SHOPEE','TOKOPEDIA','TIKTOK','WEBSITE','WHATSAPP','INSTAGRAM','LAINNYA'].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
        <div><Label>Metode Pembayaran</Label><select value={metode} onChange={e => setMetode(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-white text-sm">{['MARKETPLACE','TRANSFER','COD','QRIS','EDC','LAINNYA'].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
        <div><Label>Faktur</Label><select value={faktur} onChange={e => setFaktur(e.target.value as 'FAKTUR' | 'NON_FAKTUR')} className="w-full h-10 px-3 rounded-md border bg-white text-sm"><option value="NON_FAKTUR">Non Faktur</option><option value="FAKTUR">Faktur</option></select></div>
        <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-bold text-slate-700">Pengaruh ke Stok</Label>
            <p className="text-xs text-slate-500 mt-1">
              Aktifkan jika pesanan online ini harus langsung mengurangi stok barang/varian.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={kurangiStok} onChange={e => setKurangiStok(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500" />
            <span className="text-sm font-semibold text-slate-700">{kurangiStok ? 'Kurangi Stok' : 'Tidak Kurangi Stok'}</span>
          </label>
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm bg-white ring-1 ring-slate-200/60"><CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9]"><CardTitle className="flex items-center gap-2 text-base"><User className="w-4 h-4"/>Data Pelanggan</CardTitle></CardHeader><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Nama Pelanggan *</Label><Input {...register('nama_pelanggan', { required: true })} placeholder="Nama pelanggan" />{errors.nama_pelanggan && <p className="text-xs text-red-500 mt-1">Nama pelanggan wajib diisi</p>}</div>
        <div><Label>Nomor Telepon *</Label><Input {...register('no_hp', { required: true })} type="tel" placeholder="08xxxx" />{errors.no_hp && <p className="text-xs text-red-500 mt-1">Nomor telepon wajib diisi</p>}</div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm bg-white ring-1 ring-slate-200/60"><CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9]"><CardTitle className="flex items-center gap-2 text-base"><MapPin className="w-4 h-4"/>Alamat Pengiriman</CardTitle></CardHeader><CardContent className="p-6"><AlamatForm label="Alamat" value={alamat} onChange={setAlamat}/></CardContent></Card>

      <Card className="border-0 shadow-sm bg-white ring-1 ring-slate-200/60"><CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9]"><CardTitle className="flex items-center gap-2 text-base"><PackageOpen className="w-4 h-4"/>Produk</CardTitle></CardHeader><CardContent className="p-6 space-y-4"><BarangSelector onSelect={addItem}/>
        {items.map((item, idx) => <div key={`${item.barang_id}-${idx}`} className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl border bg-slate-50">
          <div className="col-span-12 md:col-span-4"><div className="font-semibold text-sm text-slate-800">{item.nama}</div><div className="text-xs text-slate-500">{item.barang_id}</div></div>
          <div className="col-span-6 md:col-span-2"><Label className="text-xs">Varian</Label><select value={item.varian_id || ''} onChange={e => { const v = item.varian_list.find((x:any) => String(x.id) === e.target.value); updateItem(idx, 'varian_id', v?.id || null); updateItem(idx, 'varian_nama', v?.nama || null); }} className="w-full h-9 rounded-md border bg-white text-sm px-2"><option value="">-</option>{item.varian_list.map((v:any) => <option key={v.id} value={v.id}>{v.nama}</option>)}</select></div>
          <div className="col-span-3 md:col-span-1"><Label className="text-xs">Qty</Label><Input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))}/></div>
          <div className="col-span-6 md:col-span-2"><Label className="text-xs">Harga</Label><Input type="number" value={item.harga_satuan} onChange={e => updateItem(idx, 'harga_satuan', Number(e.target.value))}/></div>
          <div className="col-span-3 md:col-span-1"><Label className="text-xs">Diskon %</Label><Input type="number" value={item.diskon} onChange={e => updateItem(idx, 'diskon', Number(e.target.value))}/></div>
          <div className="col-span-9 md:col-span-1 text-right font-bold text-red-600">{formatRupiah(item.qty * item.harga_satuan * (1 - Math.max(0, item.diskon || 0)/100))}</div>
          <button type="button" onClick={() => removeItem(idx)} className="col-span-3 md:col-span-1 flex justify-center text-red-500"><Trash2 className="w-4 h-4"/></button>
        </div>)}
      </CardContent></Card>

      <Card className="border-0 shadow-sm bg-white ring-1 ring-slate-200/60"><CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9]"><CardTitle className="flex items-center gap-2 text-base"><Truck className="w-4 h-4"/>Biaya & Catatan</CardTitle></CardHeader><CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div><Label>Ongkir</Label><Input type="number" {...register('ongkir')} /></div><div><Label>Biaya Lain</Label><Input type="number" {...register('biaya_lain')} /></div><div><Label>Diskon Order</Label><Input type="number" {...register('diskon_order')} /></div><div><Label>Catatan</Label><Input {...register('catatan')} placeholder="Opsional" /></div>
      </CardContent></Card>

      <div className="sticky bottom-4 z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/95 backdrop-blur border rounded-2xl p-4 shadow-xl"><div><div className="text-xs text-slate-500 font-semibold">Grand Total</div><div className="text-2xl font-extrabold text-red-600">{formatRupiah(grandTotal)}</div></div><Button type="submit" disabled={loading} className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white rounded-xl">{loading ? 'Menyimpan...' : 'Simpan Penjualan Online'}</Button></div>
    </form>
  </div>;
}
