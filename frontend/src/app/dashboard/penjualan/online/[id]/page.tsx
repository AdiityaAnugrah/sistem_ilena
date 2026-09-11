'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateInput from '@/components/ui/DateInput';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText, Package, User, Wallet, RotateCcw } from 'lucide-react';

type StatusTarget = 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
type ApiError = AxiosError<{ message?: string }>;
type OnlineItem = { id: number; barang_id: string; varian_nama?: string | null; qty: number; qty_net: number; qty_retur_total: number; subtotal_net: number; barang?: { nama?: string } | null };
type OnlineInvoice = { id: number; nomor_invoice: string; tanggal: string; printed_at?: string | null };
type OnlineSuratJalan = { id: number; nomor_surat: string; tanggal: string };
type OnlineRetur = { id: number; tanggal: string; qty_retur: number; catatan?: string | null; item?: { barang_id?: string } | null };
type OnlineData = {
  id_pesanan: string; channel: string; tanggal: string; status: string; nama_pelanggan: string; no_hp: string;
  alamat_detail?: string; kelurahan?: { label?: string }; kecamatan?: { label?: string }; kabupaten?: { label?: string }; provinsi?: { label?: string }; kode_pos?: string;
  invoices?: OnlineInvoice[]; suratJalans?: OnlineSuratJalan[]; items?: OnlineItem[]; returs?: OnlineRetur[];
  subtotal_net: number; biaya_lain: number; diskon_order: number; total_tagihan: number; pendapatan_bersih?: number | null;
  metode_pembayaran: string; faktur: string; kurangi_stok: number; qty_net: number;
};

function StatusTimeline({ status, completed }: { status: string; completed: boolean }) {
  const normalStages = ['DIPROSES', 'DIKIRIM', 'SELESAI'];
  const terminal = status === 'DIBATALKAN' || status === 'RETUR' ? status : null;
  const activeIndex = normalStages.indexOf(status);
  const stages = terminal ? [...normalStages, terminal] : normalStages;
  const isPassed = (stage: string, index: number) => {
    if (!terminal) return index < activeIndex;
    if (status === 'DIBATALKAN') return stage === 'DIPROSES';
    if (status === 'RETUR') return stage === 'DIPROSES' || stage === 'DIKIRIM' || (stage === 'SELESAI' && completed);
    return false;
  };

  return <div className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Riwayat status">
    {stages.map((stage, index) => {
      const active = stage === status;
      const passed = isPassed(stage, index);
      const colors = active ? 'bg-red-600 text-white ring-red-200' : passed ? 'bg-green-600 text-white ring-green-200' : 'bg-slate-200 text-slate-500 ring-slate-100';
      return <div key={`${stage}-${index}`} className="flex items-center gap-1.5">{index > 0 && <span className={`h-0.5 w-4 ${passed || active ? 'bg-green-500' : 'bg-slate-200'}`}/>}<span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-2 ${colors}`}>{stage}</span></div>;
    })}
  </div>;
}

export default function PenjualanOnlineDetail() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<OnlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returOpen, setReturOpen] = useState(false);
  const [returTanggal, setReturTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [returCatatan, setReturCatatan] = useState('');
  const [returQty, setReturQty] = useState<Record<number, number>>({});
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [pendapatanBersih, setPendapatanBersih] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(`/penjualan-online/${id}`); setData(res.data); }
    catch { toast.error('Gagal memuat detail online'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const updateStatus = async () => {
    if (!statusTarget) return;
    if (statusTarget === 'SELESAI' && pendapatanBersih.trim() === '') {
      toast.error('Pendapatan bersih wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/penjualan-online/${id}/status`, {
        status: statusTarget,
        ...(statusTarget === 'SELESAI' ? { pendapatan_bersih: Number(pendapatanBersih) } : {}),
      });
      toast.success(statusTarget === 'SELESAI' ? 'Pesanan selesai dan pendapatan bersih tersimpan' : `Status diubah ke ${statusTarget}`);
      setStatusTarget(null);
      setPendapatanBersih('');
      void fetchData();
    } catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal update status'); }
    finally { setSaving(false); }
  };

  const createDoc = async (type:'surat-jalan'|'invoice') => {
    setSaving(true);
    try {
      const res = await api.post(`/penjualan-online/${id}/${type}`, { tanggal: new Date().toISOString().split('T')[0] });
      toast.success(res.data.nomor_surat || res.data.nomor_invoice);
      void fetchData();
    } catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal membuat dokumen'); }
    finally { setSaving(false); }
  };

  const printDoc = async (type:'surat-jalan-online'|'invoice-online', docId:number) => {
    const res = await api.post('/auth/print-token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const printWindow = window.open(`${baseUrl}/dokumen/${type}/${docId}/print?token=${res.data.token}`, '_blank');
    if (!printWindow) return toast.error('Popup diblokir browser. Izinkan popup untuk mencetak dokumen.');
    if (type === 'invoice-online') window.setTimeout(() => { void fetchData(); }, 1200);
  };

  const submitRetur = async () => {
    const items = Object.entries(returQty).filter(([,q]) => Number(q) > 0).map(([itemId, q]) => ({ penjualan_online_item_id: Number(itemId), qty_retur: Number(q) }));
    if (!items.length) return toast.error('Isi minimal 1 qty retur');
    if (!returCatatan.trim()) return toast.error('Alasan retur wajib diisi');
    setSaving(true);
    try {
      const res = await api.post(`/penjualan-online/${id}/retur`, { tanggal: returTanggal, catatan: returCatatan, items });
      toast.success(res.data.message || 'Retur dicatat');
      setReturOpen(false); setReturQty({}); setReturCatatan(''); void fetchData();
    } catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal retur'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-500">Memuat data...</div>;
  if (!data) return <div className="p-8">Data tidak ditemukan.</div>;

  const alamat = [data.alamat_detail, data.kelurahan?.label, data.kecamatan?.label, data.kabupaten?.label, data.provinsi?.label, data.kode_pos].filter(Boolean).join(', ');
  const invoice = data.invoices?.[0];
  const suratJalan = data.suratJalans?.[0];
  const invoiceSudahDicetak = Boolean(invoice?.printed_at);
  const canRetur = ['DIKIRIM', 'SELESAI'].includes(data.status);

  return <div className="max-w-6xl mx-auto pb-12 space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div><Link href="/dashboard/penjualan/online" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-3"><ArrowLeft className="w-4 h-4"/>Kembali</Link><h1 className="text-2xl font-bold text-slate-800">Pesanan {data.id_pesanan}</h1><p className="text-sm text-slate-500">{data.channel} · {formatDate(data.tanggal)}</p></div>
      <div className="space-y-3"><StatusTimeline status={data.status} completed={data.pendapatan_bersih !== null && data.pendapatan_bersih !== undefined}/><div className="flex gap-2 flex-wrap justify-end">{data.status === 'DIPROSES' && <><Button disabled={saving || !suratJalan} onClick={() => setStatusTarget('DIKIRIM')}>Ubah ke DIKIRIM</Button><Button disabled={saving} variant="outline" onClick={() => setStatusTarget('DIBATALKAN')}>Batalkan</Button></>}{data.status === 'DIKIRIM' && <Button disabled={saving} onClick={() => setStatusTarget('SELESAI')}>Selesaikan Pesanan</Button>}</div></div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><User className="w-4 h-4"/>Pelanggan</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><div><b>{data.nama_pelanggan}</b></div><div>{data.no_hp}</div><div className="text-slate-500">{alamat || '-'}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><FileText className="w-4 h-4"/>Dokumen Online</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="text-xs text-slate-500">Urutan dokumen: buat dan cetak Invoice, lalu buat Surat Jalan.</div>
        {!invoice && <Button disabled={saving || data.status !== 'DIPROSES'} onClick={() => createDoc('invoice')} className="w-full bg-red-600 hover:bg-red-700">Buat Invoice Online</Button>}
        {invoice && <div className="rounded-lg bg-slate-50 border px-3 py-2 flex items-center justify-between gap-2"><div><b>{invoice.nomor_invoice}</b><br/><span className="text-xs text-slate-500">{formatDate(invoice.tanggal)} · {invoiceSudahDicetak ? 'Sudah dicetak' : 'Belum dicetak'}</span></div><Button size="sm" variant="outline" onClick={() => printDoc('invoice-online', invoice.id)}>Cetak Invoice</Button></div>}
        {invoiceSudahDicetak && !suratJalan && <Button disabled={saving || data.status !== 'DIPROSES'} onClick={() => createDoc('surat-jalan')} className="w-full bg-red-600 hover:bg-red-700">Buat SJ Online</Button>}
        {!invoiceSudahDicetak && invoice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Cetak Invoice agar Surat Jalan dapat dibuat.</p>}
        {suratJalan && <div className="rounded-lg bg-slate-50 border px-3 py-2 flex items-center justify-between gap-2"><div><b>{suratJalan.nomor_surat}</b><br/><span className="text-xs text-slate-500">{formatDate(suratJalan.tanggal)}</span></div><Button size="sm" variant="outline" onClick={() => printDoc('surat-jalan-online', suratJalan.id)}>Cetak SJ</Button></div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center text-base"><Wallet className="w-4 h-4"/>Ringkasan</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><b>{formatRupiah(data.subtotal_net)}</b></div><div className="flex justify-between"><span>Biaya lain</span><b>{formatRupiah(data.biaya_lain)}</b></div><div className="flex justify-between"><span>Diskon</span><b>- {formatRupiah(data.diskon_order)}</b></div><div className="border-t pt-2 flex justify-between text-base"><span>Total</span><b className="text-red-600">{formatRupiah(data.total_tagihan)}</b></div>{data.pendapatan_bersih !== null && <div className="flex justify-between rounded-lg bg-green-50 px-2 py-1 text-green-700"><span>Pendapatan bersih</span><b>{formatRupiah(data.pendapatan_bersih)}</b></div>}<div className="text-xs text-slate-500">Metode: {data.metode_pembayaran} · {data.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}</div><div className={`text-xs font-semibold rounded-lg px-2 py-1 w-fit ${data.kurangi_stok ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{data.kurangi_stok ? 'Stok dikurangi saat input' : 'Tidak mengurangi stok'}</div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="flex items-center justify-between text-base"><span className="flex items-center gap-2"><Package className="w-4 h-4"/>Produk</span>{canRetur && data.qty_net > 0 && <Button variant="outline" onClick={() => setReturOpen(!returOpen)}><RotateCcw className="w-4 h-4 mr-2"/>Catat Retur</Button>}</CardTitle></CardHeader><CardContent className="space-y-3">
      {(data.items || []).map((item) => <div key={item.id} className="grid grid-cols-12 gap-3 items-center rounded-xl border p-3"><div className="col-span-12 md:col-span-5"><div className="font-semibold text-slate-800">{item.barang?.nama || item.barang_id}</div><div className="text-xs text-slate-500">{item.varian_nama || '-'} · ID {item.barang_id}</div></div><div className="col-span-4 md:col-span-2 text-sm">Qty: <b>{item.qty_net}</b> / {item.qty}</div><div className="col-span-4 md:col-span-2 text-sm">Retur: <b>{item.qty_retur_total}</b></div><div className="col-span-4 md:col-span-3 text-right font-bold text-red-600">{formatRupiah(item.subtotal_net)}</div></div>)}
      {returOpen && <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3"><p className="text-sm text-orange-800">Retur sebagian tidak mengubah status. Jika seluruh barang diretur, status otomatis menjadi RETUR.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><Label>Tanggal Retur</Label><DateInput value={returTanggal} onChange={e => setReturTanggal(e.target.value)} className="w-full h-10 rounded-md border px-3 bg-white"/></div><div><Label>Alasan Retur *</Label><Input value={returCatatan} onChange={e => setReturCatatan(e.target.value)} placeholder="Alasan retur wajib diisi"/></div></div>{(data.items || []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3"><div className="text-sm"><b>{item.barang?.nama || item.barang_id}</b><div className="text-xs text-slate-500">Sisa bisa retur: {item.qty_net}</div></div><Input type="number" min={0} max={item.qty_net} value={returQty[item.id] || 0} onChange={e => setReturQty(prev => ({ ...prev, [item.id]: Math.min(Number(item.qty_net), Math.max(0, Number(e.target.value))) }))} className="w-24 text-center bg-white"/></div>)}<Button disabled={saving} onClick={submitRetur} className="bg-orange-600 hover:bg-orange-700">Simpan Retur</Button></div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Riwayat Retur</CardTitle></CardHeader><CardContent>{(data.returs || []).length === 0 ? <p className="text-sm text-slate-500">Belum ada retur.</p> : <div className="space-y-2">{data.returs?.map((r) => <div key={r.id} className="rounded-lg border p-3 text-sm"><b>{formatDate(r.tanggal)}</b> · {r.qty_retur} pcs · {r.item?.barang_id}{r.catatan ? ` · ${r.catatan}` : ''}</div>)}</div>}</CardContent></Card>

    <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open && !saving) setStatusTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Konfirmasi perubahan status</DialogTitle><DialogDescription>Status akan diubah dari {data.status} ke {statusTarget}. Setelah disimpan, status tidak dapat dikembalikan ke tahap sebelumnya.</DialogDescription></DialogHeader>{statusTarget === 'SELESAI' && <div className="space-y-2"><Label htmlFor="pendapatan-bersih">Pendapatan Bersih <span className="text-red-600">*</span></Label><Input id="pendapatan-bersih" type="number" min="0" value={pendapatanBersih} onChange={(e) => setPendapatanBersih(e.target.value)} placeholder="Contoh: 1250000"/><p className="text-xs text-slate-500">Masukkan nominal bersih yang benar-benar diterima dari penjualan ini.</p></div>}<DialogFooter><Button variant="outline" disabled={saving} onClick={() => setStatusTarget(null)}>Kembali</Button><Button disabled={saving} onClick={updateStatus}>{saving ? 'Menyimpan...' : 'Ya, ubah status'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
