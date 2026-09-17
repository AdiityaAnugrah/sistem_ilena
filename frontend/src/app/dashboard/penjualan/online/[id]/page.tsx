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
import { Textarea } from '@/components/ui/textarea';
import DateInput from '@/components/ui/DateInput';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, CreditCard, FileText, Globe2, MapPin, Package, Phone, Printer, Receipt, RotateCcw, Truck, User, Wallet, XCircle } from 'lucide-react';

type StatusTarget = 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
type ConfirmTarget = 'INVOICE' | 'SURAT_JALAN' | 'RETUR';
type ApiError = AxiosError<{ message?: string }>;
type OnlineItem = { id: number; barang_id: string; varian_nama?: string | null; qty: number; qty_net: number; qty_retur_total: number; subtotal_net: number; barang?: { nama?: string } | null };
type OnlineInvoice = { id: number; nomor_invoice: string; tanggal: string; printed_at?: string | null };
type OnlineSuratJalan = { id: number; nomor_surat: string; tanggal: string; jenis?: 'PENGIRIMAN_AWAL' | 'PENGGANTIAN_RETUR'; retur_group_id?: string | null };
type OnlineRetur = { id: number; retur_group_id?: string | null; tipe?: 'PENGGANTIAN_BARANG' | 'PENGEMBALIAN_DANA'; tanggal: string; qty_retur: number; jumlah_refund?: number; catatan?: string | null; surat_jalan_pengganti_id?: number | null; item?: { barang_id?: string } | null };
type OnlineData = {
  id_pesanan: string; channel: string; tanggal: string; status: string; nama_pelanggan: string; no_hp: string;
  alamat_detail?: string; kelurahan?: { label?: string }; kecamatan?: { label?: string }; kabupaten?: { label?: string }; provinsi?: { label?: string }; kode_pos?: string;
  invoices?: OnlineInvoice[]; suratJalans?: OnlineSuratJalan[]; items?: OnlineItem[]; returs?: OnlineRetur[];
  subtotal_gross: number; total_retur: number; subtotal_net: number; biaya_lain: number; diskon_order: number; total_tagihan: number; pendapatan_bersih?: number | null;
  metode_pembayaran: string; faktur: string; kurangi_stok: number; qty_net: number;
};

const statusMap: Record<string, { label: string; cls: string; icon: any }> = {
  DIPROSES: { label: 'Diproses', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Receipt },
  DIKIRIM: { label: 'Dikirim', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Truck },
  SELESAI: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  DIBATALKAN: { label: 'Dibatalkan', cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  RETUR: { label: 'Retur', cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
};

function StatusBadge({ status }: { status: string }) {
  const current = statusMap[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200', icon: FileText };
  const Icon = current.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${current.cls}`}><Icon className="h-3.5 w-3.5" />{current.label}</span>;
}

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

  return <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5" aria-label="Riwayat status">
    {stages.map((stage, index) => {
      const active = stage === status;
      const passed = isPassed(stage, index);
      const colors = active ? 'bg-red-600 text-white ring-red-100' : passed ? 'bg-emerald-600 text-white ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-slate-50';
      return <div key={`${stage}-${index}`} className="flex items-center gap-1.5">{index > 0 && <span className={`h-0.5 w-4 ${passed || active ? 'bg-emerald-500' : 'bg-slate-200'}`}/>}<span className={`rounded-full px-3 py-1.5 text-[11px] font-black ring-2 ${colors}`}>{statusMap[stage]?.label || stage}</span></div>;
    })}
  </div>;
}

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100"><Icon className="h-4 w-4 text-slate-400" /></div>
    <div className="min-w-0"><div className="text-xs font-semibold text-slate-400">{label}</div><div className="mt-0.5 text-sm font-bold text-slate-800 break-words">{value || '-'}</div></div>
  </div>
);

const SummaryLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 text-sm text-slate-600"><span>{label}</span><b className="text-slate-900">{value}</b></div>
);

const DocItem = ({ title, subtitle, onPrint, tone = 'slate' }: { title: string; subtitle: string; onPrint: () => void; tone?: 'slate' | 'amber' }) => (
  <div className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${tone === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
    <div className="min-w-0"><div className="font-mono text-xs font-black text-slate-800 truncate">{title}</div><div className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</div></div>
    <Button size="sm" variant="outline" onClick={onPrint} className="h-9 rounded-xl bg-white font-bold"><Printer className="mr-1.5 h-3.5 w-3.5"/>Cetak</Button>
  </div>
);

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
  const [returTipe, setReturTipe] = useState<'PENGGANTIAN_BARANG' | 'PENGEMBALIAN_DANA'>('PENGGANTIAN_BARANG');
  const [returRefund, setReturRefund] = useState('');
  const [returSjAwalId, setReturSjAwalId] = useState('');
  const [returSjTanggal, setReturSjTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [pendapatanBersih, setPendapatanBersih] = useState('');
  const [sjFormOpen, setSjFormOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [invoiceTanggal, setInvoiceTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sjTanggal, setSjTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sjCatatan, setSjCatatan] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(`/penjualan-online/${id}`); setData(res.data); }
    catch { toast.error('Gagal memuat detail online'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const updateStatus = async () => {
    if (!statusTarget) return;
    if (statusTarget === 'SELESAI' && pendapatanBersih.trim() === '') return toast.error('Pendapatan bersih wajib diisi');
    if (statusTarget === 'SELESAI' && data && Number(pendapatanBersih) > Number(data.total_tagihan)) return toast.error(`Pendapatan bersih maksimal ${formatRupiah(data.total_tagihan)}`);
    setSaving(true);
    try {
      await api.patch(`/penjualan-online/${id}/status`, { status: statusTarget, ...(statusTarget === 'SELESAI' ? { pendapatan_bersih: Number(pendapatanBersih) } : {}) });
      toast.success(statusTarget === 'SELESAI' ? 'Pesanan selesai dan pendapatan bersih tersimpan' : `Status diubah ke ${statusTarget}`);
      setStatusTarget(null); setPendapatanBersih(''); void fetchData();
    } catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal update status'); }
    finally { setSaving(false); }
  };

  const createDoc = async (type:'surat-jalan'|'invoice', tanggal?: string) => {
    setSaving(true);
    try { const res = await api.post(`/penjualan-online/${id}/${type}`, { tanggal: tanggal || new Date().toISOString().split('T')[0] }); toast.success(res.data.nomor_surat || res.data.nomor_invoice); void fetchData(); }
    catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal membuat dokumen'); }
    finally { setSaving(false); }
  };

  const createSuratJalan = async () => {
    if (!sjTanggal) return toast.error('Tanggal Surat Jalan wajib diisi');
    setSaving(true);
    try { const res = await api.post(`/penjualan-online/${id}/surat-jalan`, { tanggal: sjTanggal, catatan: sjCatatan.trim() || null }); toast.success(res.data.nomor_surat || 'Surat Jalan berhasil dibuat'); setSjFormOpen(false); void fetchData(); }
    catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal membuat Surat Jalan'); }
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
    if (!returSjAwalId) return toast.error('Surat Jalan awal wajib dipilih');
    if (returTipe === 'PENGEMBALIAN_DANA' && Number(returRefund) <= 0) return toast.error('Nominal pengembalian dana wajib diisi');
    if (returTipe === 'PENGGANTIAN_BARANG' && !returSjTanggal) return toast.error('Tanggal SJ pengganti wajib diisi');
    setSaving(true);
    try {
      const res = await api.post(`/penjualan-online/${id}/retur`, { tanggal: returTanggal, catatan: returCatatan, items, tipe: returTipe, surat_jalan_awal_id: Number(returSjAwalId), ...(returTipe === 'PENGEMBALIAN_DANA' ? { jumlah_refund: Number(returRefund) } : { tanggal_sj_pengganti: returSjTanggal }) });
      toast.success(res.data.message || 'Retur dicatat');
      setReturOpen(false); setReturQty({}); setReturCatatan(''); setReturRefund(''); void fetchData();
    } catch (e) { toast.error((e as ApiError).response?.data?.message || 'Gagal retur'); }
    finally { setSaving(false); }
  };

  const executeConfirmedAction = () => {
    const target = confirmTarget; setConfirmTarget(null);
    if (target === 'INVOICE') void createDoc('invoice', invoiceTanggal);
    if (target === 'SURAT_JALAN') void createSuratJalan();
    if (target === 'RETUR') void submitRetur();
  };

  if (loading) return <div className="p-8 text-slate-500">Memuat data...</div>;
  if (!data) return <div className="p-8">Data tidak ditemukan.</div>;

  const alamat = [data.alamat_detail, data.kelurahan?.label, data.kecamatan?.label, data.kabupaten?.label, data.provinsi?.label, data.kode_pos].filter(Boolean).join(', ');
  const invoice = data.invoices?.[0];
  const suratJalan = data.suratJalans?.find((sj) => sj.jenis !== 'PENGGANTIAN_RETUR');
  const invoiceSudahDicetak = Boolean(invoice?.printed_at);
  const canRetur = ['DIKIRIM', 'SELESAI'].includes(data.status);
  const adaPengembalianDana = Number(data.total_retur || 0) > 0;

  return <div className="space-y-6 pb-12">
    <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-5 sm:p-7 text-white shadow-[0_22px_48px_rgba(15,23,42,.16)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div>
          <Link href="/dashboard/penjualan/online" className="inline-flex min-h-[36px] items-center gap-2 text-sm font-bold text-slate-300 hover:text-white mb-3"><ArrowLeft className="w-4 h-4"/>Kembali</Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/15"><Globe2 className="h-6 w-6" /></div>
            <div><h1 className="text-2xl sm:text-3xl font-black tracking-tight">Pesanan Online {data.id_pesanan}</h1><p className="mt-1 text-sm text-slate-300">{data.channel} · {formatDate(data.tanggal)} · {data.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}</p></div>
          </div>
        </div>
        <div className="space-y-3 lg:text-right"><StatusBadge status={data.status} /><StatusTimeline status={data.status} completed={data.pendapatan_bersih !== null && data.pendapatan_bersih !== undefined}/></div>
      </div>
    </div>

    <div className="flex flex-wrap justify-end gap-2">
      {data.status === 'DIPROSES' && <><Button disabled={saving || !invoiceSudahDicetak} onClick={() => setStatusTarget('DIKIRIM')} className="rounded-xl bg-red-600 font-bold hover:bg-red-700"><Truck className="mr-2 h-4 w-4"/>Ubah ke DIKIRIM</Button><Button disabled={saving} variant="outline" onClick={() => setStatusTarget('DIBATALKAN')} className="rounded-xl font-bold"><XCircle className="mr-2 h-4 w-4"/>Batalkan</Button></>}
      {data.status === 'DIKIRIM' && <Button disabled={saving || !suratJalan} onClick={() => setStatusTarget('SELESAI')} className="rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4"/>Selesaikan Pesanan</Button>}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="rounded-3xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex gap-2 items-center text-base"><User className="w-4 h-4 text-red-500"/>Pelanggan</CardTitle></CardHeader><CardContent className="space-y-4"><InfoRow icon={User} label="Nama Pelanggan" value={data.nama_pelanggan}/><InfoRow icon={Phone} label="No. HP" value={data.no_hp}/><InfoRow icon={MapPin} label="Alamat" value={alamat || '-'}/></CardContent></Card>
      <Card className="rounded-3xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex gap-2 items-center text-base"><FileText className="w-4 h-4 text-red-500"/>Dokumen Online</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs font-semibold text-slate-500">Urutan: buat dan cetak Invoice, ubah status ke DIKIRIM, lalu buat Surat Jalan.</div>
        {!invoice && <Button disabled={saving || data.status !== 'DIPROSES'} onClick={() => setInvoiceFormOpen(true)} className="w-full rounded-xl bg-red-600 font-bold hover:bg-red-700"><Receipt className="mr-2 h-4 w-4"/>Buat Invoice Online</Button>}
        {invoice && <DocItem title={invoice.nomor_invoice} subtitle={`${formatDate(invoice.tanggal)} · ${invoiceSudahDicetak ? 'Sudah dicetak' : 'Belum dicetak'}`} onPrint={() => printDoc('invoice-online', invoice.id)} tone={invoiceSudahDicetak ? 'slate' : 'amber'} />}
        {invoiceSudahDicetak && data.status === 'DIKIRIM' && !suratJalan && <Button disabled={saving} onClick={() => setSjFormOpen(true)} className="w-full rounded-xl bg-red-600 font-bold hover:bg-red-700"><Truck className="mr-2 h-4 w-4"/>Buat SJ Online</Button>}
        {!invoiceSudahDicetak && invoice && <p className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">Cetak Invoice agar status dapat diubah ke DIKIRIM.</p>}
        {invoiceSudahDicetak && data.status === 'DIPROSES' && <p className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">Ubah status ke DIKIRIM untuk membuat Surat Jalan.</p>}
        {data.status === 'DIKIRIM' && !suratJalan && <p className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">Buat Surat Jalan sebelum menyelesaikan pesanan.</p>}
        {(data.suratJalans || []).map((sj) => <DocItem key={sj.id} title={sj.nomor_surat} subtitle={`${formatDate(sj.tanggal)} · ${sj.jenis === 'PENGGANTIAN_RETUR' ? 'SJ Pengganti Retur' : 'SJ Pengiriman Awal'}`} onPrint={() => printDoc('surat-jalan-online', sj.id)} tone={sj.jenis === 'PENGGANTIAN_RETUR' ? 'amber' : 'slate'} />)}
      </CardContent></Card>
      <Card className="rounded-3xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex gap-2 items-center text-base"><Wallet className="w-4 h-4 text-red-500"/>Ringkasan</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><SummaryLine label={adaPengembalianDana ? 'Subtotal Awal' : 'Subtotal'} value={formatRupiah(data.subtotal_gross)}/><SummaryLine label="Biaya lain" value={formatRupiah(data.biaya_lain)}/><SummaryLine label="Diskon" value={`- ${formatRupiah(data.diskon_order)}`}/>{adaPengembalianDana && <div className="rounded-2xl bg-orange-50 border border-orange-100 p-2"><SummaryLine label="Retur Pengembalian Dana" value={`- ${formatRupiah(data.total_retur)}`} /></div>}<div className="border-t pt-3 flex justify-between text-base"><span className="font-bold text-slate-600">{adaPengembalianDana ? 'Total Setelah Retur' : 'Total'}</span><b className="text-red-600">{formatRupiah(data.total_tagihan)}</b></div>{data.pendapatan_bersih !== null && <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-2"><SummaryLine label="Pendapatan bersih" value={formatRupiah(data.pendapatan_bersih || 0)} /></div>}<div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs font-bold text-slate-500"><CreditCard className="h-4 w-4"/>Metode: {data.metode_pembayaran}</div><div className={`text-xs font-black rounded-2xl border px-3 py-2 w-fit ${data.kurangi_stok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{data.kurangi_stok ? 'Stok dikurangi' : 'Tidak mengurangi stok'}</div></CardContent></Card>
    </div>

    <Card className="rounded-3xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-base"><span className="flex items-center gap-2"><Package className="w-4 h-4 text-red-500"/>Produk Pesanan</span>{canRetur && data.qty_net > 0 && <Button variant="outline" onClick={() => setReturOpen(!returOpen)} className="rounded-xl font-bold"><RotateCcw className="w-4 h-4 mr-2"/>Catat Retur</Button>}</CardTitle></CardHeader><CardContent className="space-y-3">
      {(data.items || []).map((item) => <div key={item.id} className="grid grid-cols-12 gap-3 items-center rounded-2xl border border-slate-100 bg-white p-4 hover:bg-slate-50 transition-colors"><div className="col-span-12 md:col-span-5"><div className="font-black text-slate-800">{item.barang?.nama || item.barang_id}</div><div className="text-xs font-semibold text-slate-500 mt-1">{item.varian_nama || '-'} · ID {item.barang_id}</div></div><div className="col-span-4 md:col-span-2 text-sm text-slate-600">Qty: <b className="text-slate-900">{item.qty_net}</b> / {item.qty}</div><div className="col-span-4 md:col-span-2 text-sm text-slate-600">Retur: <b className="text-slate-900">{item.qty_retur_total}</b></div><div className="col-span-4 md:col-span-3 text-right font-black text-red-600">{formatRupiah(item.subtotal_net)}</div></div>)}
      {returOpen && <div className="mt-4 rounded-3xl border border-orange-200 bg-orange-50 p-4 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Button type="button" variant={returTipe === 'PENGGANTIAN_BARANG' ? 'default' : 'outline'} onClick={() => setReturTipe('PENGGANTIAN_BARANG')} className="rounded-xl font-bold">Penggantian Barang</Button><Button type="button" variant={returTipe === 'PENGEMBALIAN_DANA' ? 'default' : 'outline'} onClick={() => setReturTipe('PENGEMBALIAN_DANA')} className="rounded-xl font-bold">Pengembalian Dana</Button></div><p className="text-sm font-semibold text-orange-800">{returTipe === 'PENGGANTIAN_BARANG' ? 'Sistem langsung membuat SJ pengganti yang tetap terkait dengan invoice ini.' : 'Tidak membuat SJ baru. Nominal refund akan mengurangi pendapatan bersih.'}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><Label>Tanggal Retur</Label><DateInput value={returTanggal} onChange={e => setReturTanggal(e.target.value)} className="w-full h-10 rounded-xl border px-3 bg-white"/></div><div><Label>Surat Jalan Awal *</Label><select value={returSjAwalId} onChange={e => setReturSjAwalId(e.target.value)} className="w-full h-10 rounded-xl border px-3 bg-white"><option value="">Pilih SJ awal</option>{(data.suratJalans || []).filter(sj => sj.jenis !== 'PENGGANTIAN_RETUR').map(sj => <option key={sj.id} value={sj.id}>{sj.nomor_surat}</option>)}</select></div>{returTipe === 'PENGGANTIAN_BARANG' ? <div><Label>Tanggal SJ Pengganti *</Label><DateInput value={returSjTanggal} onChange={e => setReturSjTanggal(e.target.value)} className="w-full h-10 rounded-xl border px-3 bg-white"/></div> : <div><Label>Nominal Dana Dikembalikan *</Label><Input type="number" min="1" value={returRefund} onChange={e => setReturRefund(e.target.value)} placeholder="Contoh: 150000" className="rounded-xl bg-white"/></div>}<div><Label>Alasan Retur *</Label><Input value={returCatatan} onChange={e => setReturCatatan(e.target.value)} placeholder="Alasan retur wajib diisi" className="rounded-xl bg-white"/></div></div>{(data.items || []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3"><div className="text-sm"><b>{item.barang?.nama || item.barang_id}</b><div className="text-xs text-slate-500">Sisa bisa diretur: {item.qty_net}</div></div><Input type="number" min={0} max={item.qty_net} value={returQty[item.id] || 0} onChange={e => setReturQty(prev => ({ ...prev, [item.id]: Math.min(Number(item.qty_net), Math.max(0, Number(e.target.value))) }))} className="w-24 text-center rounded-xl bg-white"/></div>)}<Button disabled={saving} onClick={() => setConfirmTarget('RETUR')} className="rounded-xl bg-orange-600 font-bold hover:bg-orange-700">{saving ? 'Menyimpan...' : 'Simpan Retur'}</Button></div>}
    </CardContent></Card>

    <Card className="rounded-3xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4 text-red-500"/>Riwayat Retur</CardTitle></CardHeader><CardContent>{(data.returs || []).length === 0 ? <p className="text-sm font-semibold text-slate-500">Belum ada retur.</p> : <div className="space-y-2">{data.returs?.map((r) => { const sjPengganti = data.suratJalans?.find(sj => sj.id === r.surat_jalan_pengganti_id); return <div key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><b>{formatDate(r.tanggal)}</b> · {r.tipe === 'PENGEMBALIAN_DANA' ? 'Pengembalian Dana' : 'Penggantian Barang'} · {r.qty_retur} pcs · {r.item?.barang_id}{Number(r.jumlah_refund) > 0 ? ` · ${formatRupiah(Number(r.jumlah_refund))}` : ''}{sjPengganti ? ` · SJ ${sjPengganti.nomor_surat}` : ''}{r.catatan ? ` · ${r.catatan}` : ''}</div>; })}</div>}</CardContent></Card>

    <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open && !saving) setStatusTarget(null); }}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Konfirmasi perubahan status</DialogTitle><DialogDescription>Status akan diubah dari {statusMap[data.status]?.label || data.status} ke {statusTarget ? statusMap[statusTarget]?.label || statusTarget : '-'}. Setelah disimpan, status tidak dapat dikembalikan ke tahap sebelumnya.</DialogDescription></DialogHeader>{statusTarget === 'SELESAI' && <div className="space-y-2"><Label htmlFor="pendapatan-bersih">Pendapatan Bersih <span className="text-red-600">*</span></Label><Input id="pendapatan-bersih" type="number" min="0" value={pendapatanBersih} onChange={(e) => setPendapatanBersih(e.target.value)} placeholder="Contoh: 1250000" className="rounded-xl"/><p className="text-xs text-slate-500">Masukkan nominal bersih yang benar-benar diterima dari penjualan ini.</p></div>}<DialogFooter><Button variant="outline" disabled={saving} onClick={() => setStatusTarget(null)} className="rounded-xl">Kembali</Button><Button disabled={saving} onClick={updateStatus} className="rounded-xl">{saving ? 'Menyimpan...' : 'Ya, ubah status'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={invoiceFormOpen} onOpenChange={(open) => { if (!saving) setInvoiceFormOpen(open); }}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Buat Invoice Online</DialogTitle><DialogDescription>Pilih tanggal invoice. Nomor invoice akan mengikuti tanggal yang dipilih.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="invoice-tanggal">Tanggal Invoice <span className="text-red-600">*</span></Label><DateInput id="invoice-tanggal" value={invoiceTanggal} onChange={(e) => setInvoiceTanggal(e.target.value)} className="w-full h-10 rounded-xl border px-3"/><p className="text-xs text-slate-500">Default-nya tanggal hari ini, tapi bisa diganti jika invoice perlu mengikuti tanggal lain.</p></div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setInvoiceFormOpen(false)} className="rounded-xl">Batal</Button><Button disabled={saving || !invoiceTanggal} onClick={() => { setInvoiceFormOpen(false); setConfirmTarget('INVOICE'); }} className="rounded-xl">{saving ? 'Menyimpan...' : 'Lanjutkan'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={sjFormOpen} onOpenChange={(open) => { if (!saving) setSjFormOpen(open); }}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Buat Surat Jalan Online</DialogTitle><DialogDescription>Tentukan tanggal dan keterangan yang akan ditampilkan pada Surat Jalan.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="sj-tanggal">Tanggal Surat Jalan <span className="text-red-600">*</span></Label><DateInput id="sj-tanggal" value={sjTanggal} onChange={(e) => setSjTanggal(e.target.value)} className="w-full h-10 rounded-xl border px-3"/></div><div className="space-y-2"><Label htmlFor="sj-catatan">Keterangan</Label><Textarea id="sj-catatan" value={sjCatatan} onChange={(e) => setSjCatatan(e.target.value)} placeholder="Masukkan keterangan Surat Jalan (opsional)" rows={4} className="rounded-xl"/><p className="text-xs text-slate-500">Keterangan akan tampil tepat di atas baris tanggal pada SJ online.</p></div></div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setSjFormOpen(false)} className="rounded-xl">Batal</Button><Button disabled={saving || !sjTanggal} onClick={() => { setSjFormOpen(false); setConfirmTarget('SURAT_JALAN'); }} className="rounded-xl">{saving ? 'Menyimpan...' : 'Lanjutkan'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(confirmTarget)} onOpenChange={(open) => { if (!open && !saving) setConfirmTarget(null); }}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Konfirmasi tindakan</DialogTitle><DialogDescription>{confirmTarget === 'INVOICE' && `Apakah data sudah benar dan Anda yakin ingin membuat Invoice Online tanggal ${formatDate(invoiceTanggal)}?`}{confirmTarget === 'SURAT_JALAN' && `Apakah Anda yakin ingin membuat Surat Jalan tanggal ${formatDate(sjTanggal)}?`}{confirmTarget === 'RETUR' && `Apakah data retur sudah benar dan Anda yakin ingin menyimpan ${returTipe === 'PENGGANTIAN_BARANG' ? 'penggantian barang beserta SJ baru' : `pengembalian dana ${formatRupiah(Number(returRefund || 0))}`}?`} Setelah dikonfirmasi, proses akan langsung dijalankan.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => { const target = confirmTarget; setConfirmTarget(null); if (target === 'INVOICE') setInvoiceFormOpen(true); if (target === 'SURAT_JALAN') setSjFormOpen(true); }} className="rounded-xl">Periksa Lagi</Button><Button disabled={saving} onClick={executeConfirmedAction} className="rounded-xl">{saving ? 'Memproses...' : 'Ya, lanjutkan'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
