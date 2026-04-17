'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AlamatForm from '@/components/forms/AlamatForm';
import BarangSelector from '@/components/forms/BarangSelector';
import { formatRupiah } from '@/lib/utils';
import { Trash2, Plus, Minus, PackageOpen, LayoutPanelTop, User, MapPin, Wallet2 } from 'lucide-react';

interface AlamatState {
  provinsi_id: number | null;
  kabupaten_id: number | null;
  kecamatan_id: number | null;
  kelurahan_id: number | null;
  detail: string;
}
const emptyAlamat: AlamatState = { provinsi_id: null, kabupaten_id: null, kecamatan_id: null, kelurahan_id: null, detail: '' };

function parseDimensi(deskripsi: any): string {
  try {
    const d = typeof deskripsi === 'string' ? JSON.parse(deskripsi) : deskripsi;
    if (d?.dimensi?.asli) {
      const { panjang, lebar, tinggi } = d.dimensi.asli;
      const parts = [panjang, lebar, tinggi].filter(v => v && Number(v) > 0);
      if (parts.length > 0) return parts.join(' × ') + ' mm';
    }
  } catch { /* */ }
  return '';
}

export default function PenjualanOfflineBaru() {
  const router = useRouter();
  // Using URL search params for Display logic redirection
  const [tipe, setTipe] = useState<'PENJUALAN' | 'DISPLAY'>('PENJUALAN');
  const [faktur, setFaktur] = useState<'FAKTUR' | 'NON_FAKTUR'>('FAKTUR');
  
  // Set tipe on mount if parameter provided
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tipe') === 'DISPLAY') {
      setTipe('DISPLAY');
    }
  }, []);
  const [alamatPengirim, setAlamatPengirim] = useState(emptyAlamat);
  const [alamatTagihan, setAlamatTagihan] = useState(emptyAlamat);
  const [tagihanSamaPengirim, setTagihanSamaPengirim] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    defaultValues: { tanggal: new Date().toISOString().split('T')[0] },
  });

  const addItem = (barang: any) => {
    let varianList: any[] = [];
    try { varianList = barang.varian ? JSON.parse(barang.varian) : []; } catch { varianList = []; }
    // filter varian kosong
    varianList = varianList.filter((v: any) => v.nama && v.nama.trim() !== '');

    const defaultVarian = varianList.length > 0 ? varianList[0] : null;

    // Cek duplikat berdasarkan barang_id + varian
    if (items.find(i => i.barang_id === barang.id && i.varian_nama === (defaultVarian?.nama || null))) {
      toast.error('Barang dengan warna yang sama sudah ditambahkan');
      return;
    }
    setItems(prev => [...prev, {
      barang_id: barang.id,
      nama: barang.nama,
      deskripsi: barang.deskripsi || null,
      varian_list: varianList,
      varian_nama: defaultVarian?.nama || null,
      varian_id: defaultVarian?.id || null,
      qty: 1,
      harga_asli: Number(barang.harga),
      harga_satuan: Number(barang.harga),
      harga_custom: Number(barang.harga),
      hargaMode: 'diskon' as 'diskon' | 'harga',
      diskon: 0,
    }]);
  };

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const getSubtotal = (item: any) => {
    if (tipe === 'DISPLAY') return item.qty * item.harga_satuan;
    if (item.hargaMode === 'harga') return item.qty * (Number(item.harga_custom) || item.harga_asli);
    return item.qty * item.harga_satuan * (1 - (item.diskon || 0) / 100);
  };

  const onSubmit = async (formData: any) => {
    if (items.length === 0) { toast.error('Minimal 1 produk wajib ditambahkan'); return; }
    setLoading(true);
    try {
      const payload = {
        tipe, faktur: tipe === 'DISPLAY' ? 'NON_FAKTUR' : faktur,
        nama_penerima: formData.nama_penerima,
        no_hp_penerima: formData.no_hp_penerima,
        no_po: formData.no_po || null,
        tanggal: formData.tanggal,
        nama_npwp: formData.nama_npwp || null,
        no_npwp: formData.no_npwp || null,
        pengirim_provinsi_id: alamatPengirim.provinsi_id,
        pengirim_kabupaten_id: alamatPengirim.kabupaten_id,
        pengirim_kecamatan_id: alamatPengirim.kecamatan_id,
        pengirim_kelurahan_id: alamatPengirim.kelurahan_id,
        pengirim_detail: alamatPengirim.detail,
        tagihan_sama_pengirim: tagihanSamaPengirim,
        tagihan_provinsi_id: alamatTagihan.provinsi_id,
        tagihan_kabupaten_id: alamatTagihan.kabupaten_id,
        tagihan_kecamatan_id: alamatTagihan.kecamatan_id,
        tagihan_kelurahan_id: alamatTagihan.kelurahan_id,
        tagihan_detail: alamatTagihan.detail,
        items: items.map(item => {
          let harga_satuan = item.harga_satuan;
          let diskon = item.diskon;
          if (tipe === 'DISPLAY') {
            // Hitung diskon sintetis agar [SPECIAL PRICE] muncul di invoice
            diskon = item.harga_asli > 0 ? Math.max(0, Math.round((1 - item.harga_satuan / item.harga_asli) * 100)) : 0;
          } else if (item.hargaMode === 'harga') {
            // Mode harga jual: simpan harga asli sebagai harga_satuan, diskon dihitung
            harga_satuan = item.harga_asli;
            diskon = item.harga_asli > 0 ? Math.max(0, Math.round((1 - (Number(item.harga_custom) || item.harga_asli) / item.harga_asli) * 100)) : 0;
          }
          return {
            barang_id: item.barang_id,
            varian_nama: item.varian_nama || null,
            varian_id: item.varian_id || null,
            qty: item.qty,
            harga_satuan,
            diskon,
          };
        }),
      };
      const res = await api.post('/penjualan-offline', payload);
      toast.success('Penjualan berhasil dibuat!');
      router.push(`/dashboard/penjualan/offline/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat penjualan');
    } finally {
      setLoading(false);
    }
  };

  const total = items.reduce((s, i) => s + getSubtotal(i), 0);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-200 ring-4 ring-red-50">
            <PackageOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight">Penjualan Offline Baru</h1>
            <p className="text-xs lg:text-sm text-slate-500 font-medium">Input data pesanan barang offline / toko</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tipe & Faktur */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <Wallet2 className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Jenis Transaksi</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-8 p-6 items-center">
            <div className="space-y-2.5">
              <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tipe Pesanan</Label>
              <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl w-fit">
                {(['PENJUALAN', 'DISPLAY'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setTipe(t)}
                    className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      tipe === t ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {t === 'PENJUALAN' ? 'Penjualan' : 'Display'}
                  </button>
                ))}
              </div>
            </div>

            {tipe === 'PENJUALAN' && (
              <div className="space-y-2.5">
                <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Faktur Pajak</Label>
                <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl w-fit">
                  {(['FAKTUR', 'NON_FAKTUR'] as const).map(f => (
                    <button key={f} type="button"
                      onClick={() => setFaktur(f)}
                      className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                        faktur === f ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {f === 'FAKTUR' ? 'Ya' : 'Tidak'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tipe === 'DISPLAY' && (
              <div className="flex items-end self-end mb-1">
                <div className="text-[10px] lg:text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 italic">
                  * Status faktur akan ditentukan saat barang terjual
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Identitas */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <User className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Identitas Penerima</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nama Penerima *</Label>
              <Input
                {...register('nama_penerima', {
                  required: 'Nama wajib diisi',
                  minLength: { value: 2, message: 'Minimal 2 karakter' },
                })}
                placeholder="Nama lengkap"
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.nama_penerima && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.nama_penerima.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nomor HP *</Label>
              <Input
                {...register('no_hp_penerima', {
                  required: 'Nomor HP wajib diisi',
                  pattern: { value: /^0\d{9,12}$/, message: 'Mulai dengan 0, 10–13 digit' },
                })}
                inputMode="numeric"
                maxLength={13}
                onBeforeInput={(e: any) => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault(); }}
                placeholder="0812..."
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.no_hp_penerima && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.no_hp_penerima.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Tanggal Transaksi *</Label>
              <Input 
                type="date" 
                {...register('tanggal', { required: 'Tanggal wajib diisi' })} 
                className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
              />
              {errors.tanggal && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.tanggal.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 ml-1">Nomor PO (Opsional)</Label>
              <Input {...register('no_po')} placeholder="Ref #" className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl" />
            </div>
            {faktur === 'FAKTUR' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 ml-1">Nama NPWP</Label>
                  <Input {...register('nama_npwp')} placeholder="Nama sesuai NPWP" className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 ml-1">Nomor NPWP / NIK</Label>
                  <Input
                    {...register('no_npwp')}
                    placeholder="00.000..."
                    className="bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-red-100 transition-all font-medium text-sm h-11 rounded-xl"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Alamat */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <MapPin className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm lg:text-base font-semibold text-slate-800 tracking-tight">Informasi Alamat</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 ring-1 ring-white/50">
              <AlamatForm label="Alamat Pengiriman" value={alamatPengirim} onChange={setAlamatPengirim} />
            </div>

            <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-xl transition-all hover:border-red-200 group w-fit">
              <input
                type="checkbox"
                id="samaPengirim"
                checked={tagihanSamaPengirim}
                onChange={e => setTagihanSamaPengirim(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="samaPengirim" className="text-sm font-semibold text-slate-700 cursor-pointer select-none group-hover:text-red-700">
                Alamat tagihan sama dengan pengiriman
              </label>
            </div>

            {!tagihanSamaPengirim && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 ring-1 ring-white/50 animate-in slide-in-from-top-2 duration-300">
                <AlamatForm label="Alamat Tagihan" value={alamatTagihan} onChange={setAlamatTagihan} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produk */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600 shadow-inner">
                <PackageOpen className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base lg:text-lg font-bold text-slate-800 tracking-tight">Daftar Produk</CardTitle>
                <p className="text-[11px] lg:text-xs text-slate-500 font-medium mt-0.5">Cari dan tambahkan produk ke keranjang</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6 bg-white overflow-x-auto">
            <BarangSelector onSelect={addItem} />

            {items.length > 0 && (
              <div className="overflow-x-auto border border-[#e2e8f0] rounded-2xl shadow-sm">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <tr>
                      <th className="text-left py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase">Produk</th>
                      <th className="text-center py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-32">Kuantitas</th>
                      <th className="text-left py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-48">Harga Satuan</th>
                      {tipe === 'PENJUALAN' && <th className="text-center py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-36">Diskon / Harga</th>}
                      <th className="text-right py-3 px-5 text-slate-500 font-medium text-[10px] lg:text-xs tracking-wider uppercase w-44">Subtotal</th>
                      <th className="py-3 px-5 w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800 text-[13px] lg:text-sm">{item.nama}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">ID: {item.barang_id}</span>
                            {parseDimensi(item.deskripsi) && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono font-medium">{parseDimensi(item.deskripsi)}</span>
                            )}
                            {item.varian_list && item.varian_list.length > 0 && (
                              <select
                                value={item.varian_nama || ''}
                                onChange={e => {
                                  const picked = item.varian_list.find((v: any) => v.nama === e.target.value);
                                  updateItem(idx, 'varian_nama', picked?.nama || null);
                                  updateItem(idx, 'varian_id', picked?.id || null);
                                }}
                                className="px-2 py-0.5 rounded border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
                              >
                                {item.varian_list.map((v: any) => (
                                  <option key={v.id || v.nama} value={v.nama}>{v.nama}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-between w-[100px] mx-auto border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-transparent focus-within:ring-red-200 focus-within:border-red-400 transition-all">
                            <button
                              type="button"
                              onClick={() => updateItem(idx, 'qty', Math.max(1, item.qty - 1))}
                              className="px-2.5 py-2 hover:bg-slate-100 text-slate-500 transition-colors flex items-center justify-center active:bg-slate-200"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.qty || ''}
                              onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                              className="w-8 text-center text-sm font-semibold text-slate-700 py-1.5 focus:outline-none appearance-none bg-transparent"
                              style={{ MozAppearance: 'textfield' }}
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(idx, 'qty', item.qty + 1)}
                              className="px-2.5 py-2 hover:bg-slate-100 text-slate-500 transition-colors flex items-center justify-center active:bg-slate-200"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="relative flex items-center shadow-sm group-hover:shadow transition-shadow rounded-lg">
                            <div className="absolute left-3 text-slate-400 font-bold text-sm pointer-events-none">Rp</div>
                            <input
                              type="number"
                              min={0}
                              value={item.harga_satuan || ''}
                              onBeforeInput={(e: any) => { if (e.data && !/[\d.]/.test(e.data)) e.preventDefault(); }}
                              onChange={e => updateItem(idx, 'harga_satuan', Math.max(0, Number(e.target.value)))}
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-semibold text-slate-700"
                            />
                          </div>
                        </td>
                        {tipe === 'PENJUALAN' && (
                          <td className="py-4 px-5">
                            <div className="flex flex-col items-center gap-1.5">
                              {/* Toggle mode */}
                              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-bold shadow-sm">
                                <button type="button"
                                  onClick={() => updateItem(idx, 'hargaMode', 'diskon')}
                                  className="px-2 py-1 transition-colors"
                                  style={{ background: item.hargaMode !== 'harga' ? '#FA2F2F' : '#f8fafc', color: item.hargaMode !== 'harga' ? '#fff' : '#94a3b8' }}>
                                  % Diskon
                                </button>
                                <button type="button"
                                  onClick={() => updateItem(idx, 'hargaMode', 'harga')}
                                  className="px-2 py-1 transition-colors"
                                  style={{ background: item.hargaMode === 'harga' ? '#FA2F2F' : '#f8fafc', color: item.hargaMode === 'harga' ? '#fff' : '#94a3b8' }}>
                                  Harga Jual
                                </button>
                              </div>
                              {item.hargaMode === 'harga' ? (
                                <div className="w-full">
                                  <div className="relative flex items-center">
                                    <div className="absolute left-2 text-slate-400 text-xs pointer-events-none">Rp</div>
                                    <input
                                      type="number" min={0}
                                      value={item.harga_custom || ''}
                                      onBeforeInput={(e: any) => { if (e.data && !/[\d.]/.test(e.data)) e.preventDefault(); }}
                                      onChange={e => updateItem(idx, 'harga_custom', Math.max(0, Number(e.target.value)))}
                                      className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white font-semibold text-slate-700"
                                    />
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 text-center">
                                    Asli: {formatRupiah(item.harga_asli)}
                                  </div>
                                </div>
                              ) : (
                                <div className="relative flex items-center shadow-sm w-16 mx-auto rounded-lg">
                                  <input
                                    type="number" min={0} max={100} step={1}
                                    value={item.diskon || ''}
                                    onBeforeInput={(e: any) => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault(); }}
                                    onChange={e => updateItem(idx, 'diskon', Math.min(100, Math.max(0, Math.floor(Number(e.target.value)))))}
                                    className="w-full pr-5 pl-2 py-2 text-center border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-semibold text-slate-700"
                                  />
                                  <div className="absolute right-2 text-slate-400 font-semibold text-[10px] pointer-events-none">%</div>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-4 px-5 text-right">
                          <div className="font-bold text-slate-800 tracking-tight text-[14px] lg:text-[15px]">
                            {formatRupiah(getSubtotal(item))}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shadow-sm"
                            title="Hapus Produk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200">
                    <tr className="border-t-2 border-slate-200 bg-white">
                      <td colSpan={tipe === 'PENJUALAN' ? 4 : 3} className="py-6 px-6 text-right text-slate-800 font-black uppercase tracking-widest text-[11px]">
                        Total Akhir Penjualan
                      </td>
                      <td className="py-6 px-6 text-right font-black text-red-600 text-lg lg:text-xl tracking-tight leading-none">
                        {formatRupiah(total)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
            ) : 'Simpan Penjualan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
