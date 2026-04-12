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
import { Trash2, Plus, Minus, PackageOpen } from 'lucide-react';

interface AlamatState {
  provinsi_id: number | null;
  kabupaten_id: number | null;
  kecamatan_id: number | null;
  kelurahan_id: number | null;
  detail: string;
}
const emptyAlamat: AlamatState = { provinsi_id: null, kabupaten_id: null, kecamatan_id: null, kelurahan_id: null, detail: '' };

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
  const { register, handleSubmit, formState: { errors } } = useForm();

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
      varian_list: varianList,
      varian_nama: defaultVarian?.nama || null,
      varian_id: defaultVarian?.id || null,
      qty: 1,
      harga_satuan: Number(barang.harga),
      diskon: 0,
    }]);
  };

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const getSubtotal = (item: any) => item.qty * item.harga_satuan * (1 - (item.diskon || 0) / 100);

  const onSubmit = async (formData: any) => {
    if (items.length === 0) { toast.error('Minimal 1 produk wajib ditambahkan'); return; }
    setLoading(true);
    try {
      const payload = {
        tipe, faktur,
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
        items: items.map(item => ({
          barang_id: item.barang_id,
          varian_nama: item.varian_nama || null,
          varian_id: item.varian_id || null,
          qty: item.qty,
          harga_satuan: item.harga_satuan,
          diskon: item.diskon,
        })),
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Penjualan Offline Baru</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tipe & Faktur */}
        <Card>
          <CardHeader><CardTitle className="text-base">Jenis Transaksi</CardTitle></CardHeader>
          <CardContent className="flex gap-6">
            <div>
              <Label className="text-xs mb-1 block">Tipe</Label>
              <div className="flex gap-2">
                {(['PENJUALAN', 'DISPLAY'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setTipe(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      tipe === t ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                    {t === 'PENJUALAN' ? 'Penjualan' : 'Display'}
                  </button>
                ))}
              </div>
            </div>
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
          </CardContent>
        </Card>

        {/* Identitas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Identitas Penerima</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nama Penerima *</Label>
              <Input {...register('nama_penerima', { required: true })} placeholder="Nama lengkap" />
              {errors.nama_penerima && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>No. HP Penerima *</Label>
              <Input {...register('no_hp_penerima', { required: true })} placeholder="08xx" />
              {errors.no_hp_penerima && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>Tanggal *</Label>
              <Input type="date" {...register('tanggal', { required: true })} />
              {errors.tanggal && <p className="text-red-500 text-xs mt-1">Wajib diisi</p>}
            </div>
            <div>
              <Label>No. PO</Label>
              <Input {...register('no_po')} placeholder="Nomor PO (opsional)" />
            </div>
            {faktur === 'FAKTUR' && (
              <>
                <div>
                  <Label>Nama NPWP</Label>
                  <Input {...register('nama_npwp')} placeholder="Nama sesuai NPWP" />
                </div>
                <div>
                  <Label>No. NPWP</Label>
                  <Input {...register('no_npwp')} placeholder="xx.xxx.xxx.x-xxx.xxx" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Alamat */}
        <Card>
          <CardHeader><CardTitle className="text-base">Alamat</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <AlamatForm label="Alamat Pengirim" value={alamatPengirim} onChange={setAlamatPengirim} />
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="samaPengirim"
                checked={tagihanSamaPengirim}
                onChange={e => setTagihanSamaPengirim(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="samaPengirim" className="text-sm text-gray-700 cursor-pointer">
                Alamat tagihan sama dengan alamat pengirim
              </label>
            </div>
            {!tagihanSamaPengirim && (
              <AlamatForm label="Alamat Tagihan" value={alamatTagihan} onChange={setAlamatTagihan} />
            )}
          </CardContent>
        </Card>

        {/* Produk */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="bg-[#f8fafc] border-b border-[#f1f5f9] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-100 to-red-50 border border-red-100">
                <PackageOpen className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Daftar Produk</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Cari dan tambahkan produk yang akan dibeli</p>
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
                      <th className="text-left py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase">Produk</th>
                      <th className="text-center py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-32">Kuantitas</th>
                      <th className="text-left py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-48">Harga Satuan</th>
                      <th className="text-center py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-24">Diskon</th>
                      <th className="text-right py-3.5 px-5 text-slate-600 font-semibold text-xs tracking-wider uppercase w-44">Subtotal</th>
                      <th className="py-3.5 px-5 w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-800 text-sm">{item.nama}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">ID: {item.barang_id}</span>
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
                              className="w-8 text-center text-sm font-bold text-slate-700 py-1.5 focus:outline-none appearance-none bg-transparent"
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
                              value={item.harga_satuan || ''}
                              onChange={e => updateItem(idx, 'harga_satuan', Number(e.target.value))}
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-bold text-slate-700"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="relative flex items-center shadow-sm w-16 mx-auto group-hover:shadow transition-shadow rounded-lg">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.diskon || ''}
                              onChange={e => updateItem(idx, 'diskon', Number(e.target.value))}
                              className="w-full pr-5 pl-2 py-2 text-center border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-all font-bold text-slate-700"
                            />
                            <div className="absolute right-2 text-slate-400 font-bold text-xs pointer-events-none">%</div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="font-extrabold text-slate-800 tracking-tight text-[15px]">
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
                    <tr>
                      <td colSpan={4} className="py-5 px-5 text-right text-slate-600 font-semibold tracking-wide">
                        TOTAL PENJUALAN
                      </td>
                      <td className="py-5 px-5 text-right">
                        <div className="text-xl font-black text-red-600 tracking-tight">
                          {formatRupiah(total)}
                        </div>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Penjualan'}</Button>
        </div>
      </form>
    </div>
  );
}
