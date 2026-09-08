'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/DateInput';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import { ArrowLeft, Package, Truck, User, Wallet, RotateCcw } from 'lucide-react';

export default function PenjualanOnlineDetail() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resi, setResi] = useState('');
  const [jasaKirim, setJasaKirim] = useState('');
  const [returOpen, setReturOpen] = useState(false);
  const [returTanggal, setReturTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [returCatatan, setReturCatatan] = useState('');
  const [returQty, setReturQty] = useState<Record<number, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get(`/penjualan-online/${id}`); setData(res.data); setResi(res.data.nomor_resi || ''); setJasaKirim(res.data.jasa_kirim || ''); }
    catch { toast.error('Gagal memuat detail online'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [id]);

  const updateResi = async () => { setSaving(true); try { await api.patch(`/penjualan-online/${id}/resi`, { nomor_resi: resi, jasa_kirim: jasaKirim }); toast.success('Resi diperbarui'); fetchData(); } catch (e:any) { toast.error(e.response?.data?.message || 'Gagal update resi'); } finally { setSaving(false); } };
  const updateStatus = async (status:string) => { setSaving(true); try { await api.patch(`/penjualan-online/${id}/status`, { status }); toast.success('Status diperbarui'); fetchData(); } catch (e:any) { toast.error(e.response?.data?.message || 'Gagal update status'); } finally { setSaving(false); } };
  const submitRetur = async () => {
    const items = Object.entries(returQty).filter(([,q]) => Number(q) > 0).map(([itemId, q]) => ({ penjualan_online_item_id: Number(itemId), qty_retur: Number(q) }));
    if (!items.length) { toast.error('Isi minimal 1 qty retur'); return; }
    setSaving(true); try { await api.post(`/penjualan-online/${id}/retur`, { tanggal: returTanggal, catatan: returCatatan, items }); toast.success('Retur dicatat'); setReturOpen(false); setReturQty({}); fetchData(); } catch (e:any) { toast.error(e.response?.data?.message || 'Gagal retur'); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-500">Memuat data...</div>;
  if (!data) return <div className="p-8">Data tidak ditemukan.</div>;
  const alamat = [data.alamat_detail, data.kelurahan?.label, data.kecamatan?.label, data.kabupaten?.label, data.provinsi?.label, data.kode_pos].filter(Boolean).join(', ');

  return <div className="max-w-6xl mx-auto pb-12 space-y-6">
    <div className="flex items-center justify-between gap-3"><div><Link href="/dashboard/penjualan/online" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-3"><ArrowLeft className="w-4 h-4"/>Kembali</Link><h1 className="text-2xl font-bold text-slate-800">Pesanan {data.id_pesanan}</h1><p className="text-sm text-slate-500">{data.channel} · {formatDate(data.tanggal)}</p></div><div className="flex gap-2 flex-wrap justify-end">{['DIPROSES','DIKIRIM','SELESAI','DIBATALKAN'].map(s => <Button key={s} variant={data.status === s ? 'default' : 'outline'} disabled={saving} onClick={() => updateStatus(s)}>{s}</Button>)}</div></div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><User className="w-4 h-4"/>Pelanggan</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><div><b>{data.nama_pelanggan}</b></div><div>{data.no_hp}</div><div className="text-slate-500">{alamat || '-'}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><Truck className="w-4 h-4"/>Pengiriman</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label>Jasa Kirim</Label><Input value={jasaKirim} onChange={e => setJasaKirim(e.target.value)}/></div><div><Label>Nomor Resi</Label><Input value={resi} onChange={e => setResi(e.target.value)} placeholder="Belum ada resi"/></div><Button disabled={saving} onClick={updateResi} className="w-full bg-red-600 hover:bg-red-700">Simpan Resi</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><Wallet className="w-4 h-4"/>Ringkasan</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><b>{formatRupiah(data.subtotal_net)}</b></div><div className="flex justify-between"><span>Ongkir</span><b>{formatRupiah(data.ongkir)}</b></div><div className="flex justify-between"><span>Biaya lain</span><b>{formatRupiah(data.biaya_lain)}</b></div><div className="flex justify-between"><span>Diskon</span><b>- {formatRupiah(data.diskon_order)}</b></div><div className="border-t pt-2 flex justify-between text-base"><span>Total</span><b className="text-red-600">{formatRupiah(data.total_tagihan)}</b></div><div className="text-xs text-slate-500">Metode: {data.metode_pembayaran}</div><div className={`text-xs font-semibold rounded-lg px-2 py-1 w-fit ${data.kurangi_stok ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{data.kurangi_stok ? 'Stok dikurangi saat input' : 'Tidak mengurangi stok'}</div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="flex items-center justify-between text-base"><span className="flex items-center gap-2"><Package className="w-4 h-4"/>Produk</span><Button variant="outline" onClick={() => setReturOpen(!returOpen)}><RotateCcw className="w-4 h-4 mr-2"/>Catat Retur</Button></CardTitle></CardHeader><CardContent className="space-y-3">
      {(data.items || []).map((item:any) => <div key={item.id} className="grid grid-cols-12 gap-3 items-center rounded-xl border p-3"><div className="col-span-12 md:col-span-5"><div className="font-semibold text-slate-800">{item.barang?.nama || item.barang_id}</div><div className="text-xs text-slate-500">{item.varian_nama || '-'} · ID {item.barang_id}</div></div><div className="col-span-4 md:col-span-2 text-sm">Qty: <b>{item.qty_net}</b> / {item.qty}</div><div className="col-span-4 md:col-span-2 text-sm">Retur: <b>{item.qty_retur_total}</b></div><div className="col-span-4 md:col-span-3 text-right font-bold text-red-600">{formatRupiah(item.subtotal_net)}</div></div>)}
      {returOpen && <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><Label>Tanggal Retur</Label><DateInput value={returTanggal} onChange={e => setReturTanggal(e.target.value)} className="w-full h-10 rounded-md border px-3 bg-white"/></div><div><Label>Catatan</Label><Input value={returCatatan} onChange={e => setReturCatatan(e.target.value)} placeholder="Alasan retur"/></div></div>{(data.items || []).map((item:any) => <div key={item.id} className="flex items-center justify-between gap-3"><div className="text-sm"><b>{item.barang?.nama || item.barang_id}</b><div className="text-xs text-slate-500">Sisa bisa retur: {item.qty_net}</div></div><Input type="number" min={0} max={item.qty_net} value={returQty[item.id] || 0} onChange={e => setReturQty(prev => ({ ...prev, [item.id]: Math.min(Number(item.qty_net), Math.max(0, Number(e.target.value))) }))} className="w-24 text-center bg-white"/></div>)}<Button disabled={saving} onClick={submitRetur} className="bg-orange-600 hover:bg-orange-700">Simpan Retur</Button></div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Riwayat Retur</CardTitle></CardHeader><CardContent>{(data.returs || []).length === 0 ? <p className="text-sm text-slate-500">Belum ada retur.</p> : <div className="space-y-2">{data.returs.map((r:any) => <div key={r.id} className="rounded-lg border p-3 text-sm"><b>{formatDate(r.tanggal)}</b> · {r.qty_retur} pcs · {r.item?.barang_id}{r.catatan ? ` · ${r.catatan}` : ''}</div>)}</div>}</CardContent></Card>
  </div>;
}
