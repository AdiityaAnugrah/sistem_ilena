'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DateInput from '@/components/ui/DateInput';
import toast from 'react-hot-toast';

export type OnlineSettlement = { id: number; tanggal: string; referensi: string; jumlah_bruto: number; biaya: number; jumlah_bersih: number };

export default function OnlineSettlementPanel({ saleId, rows, saldo, onSaved }: { saleId: string; rows: OnlineSettlement[]; saldo: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tanggal, setTanggal] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()));
  const [referensi, setReferensi] = useState('');
  const [bruto, setBruto] = useState('');
  const [biaya, setBiaya] = useState('0');
  const net = Number(bruto) - Number(biaya);
  const valid = tanggal && referensi.trim() && Number.isSafeInteger(Number(bruto)) && Number(bruto) > 0 && biaya !== '' && Number.isSafeInteger(Number(biaya)) && Number(biaya) >= 0 && net >= 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.post(`/penjualan-online/${saleId}/pencairan`, { tanggal, referensi: referensi.trim(), jumlah_bruto: Number(bruto), biaya: Number(biaya) });
      toast.success('Pencairan bank tercatat');
      setOpen(false); setReferensi(''); setBruto(''); setBiaya('0');
      await onSaved();
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message || 'Pencairan gagal disimpan');
    } finally { setSaving(false); }
  }

  return <Card>
    <CardHeader><CardTitle>Pencairan marketplace / gateway</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-slate-600">Catat saat dana benar-benar masuk bank. Pembayaran customer dan pendapatan bersih lama tidak otomatis menjadi pencairan.</p>
      <p className="text-sm">Saldo gateway saat ini: <strong>{formatRupiah(saldo)}</strong></p>
      {rows.length === 0 ? <p className="text-sm text-slate-500">Belum ada pencairan tercatat.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="sr-only">Riwayat pencairan bank</caption><thead><tr className="border-b"><th className="p-2">Tanggal / referensi</th><th className="p-2 text-right">Bruto</th><th className="p-2 text-right">Biaya</th><th className="p-2 text-right">Masuk bank</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b"><td className="p-2">{formatDate(row.tanggal)}<div>{row.referensi}</div></td><td className="p-2 text-right whitespace-nowrap">{formatRupiah(row.jumlah_bruto)}</td><td className="p-2 text-right whitespace-nowrap">{formatRupiah(row.biaya)}</td><td className="p-2 text-right whitespace-nowrap">{formatRupiah(row.jumlah_bersih)}</td></tr>)}</tbody></table></div>}
      <Button type="button" variant="outline" disabled={saving} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Tutup formulir' : 'Catat pencairan bank'}</Button>
      {open && <form onSubmit={save} className="space-y-3" aria-label="Catat pencairan bank">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label htmlFor="payout-date">Tanggal masuk bank</Label><DateInput id="payout-date" required value={tanggal} onChange={event => setTanggal(event.target.value)} className="w-full border rounded-md p-2" /></div>
          <div><Label htmlFor="payout-reference">Referensi bank / pencairan</Label><Input id="payout-reference" required maxLength={120} value={referensi} onChange={event => setReferensi(event.target.value)} /></div>
          <div><Label htmlFor="payout-gross">Saldo gateway yang dicairkan</Label><Input id="payout-gross" required type="number" min="1" step="1" value={bruto} onChange={event => setBruto(event.target.value)} /></div>
          <div><Label htmlFor="payout-fee">Potongan biaya</Label><Input id="payout-fee" required type="number" min="0" max={Number(bruto) || undefined} step="1" value={biaya} onChange={event => setBiaya(event.target.value)} /></div>
        </div>
        <p aria-live="polite" className="text-sm">Masuk bank: <strong>{formatRupiah(Number.isFinite(net) ? Math.max(0, net) : 0)}</strong></p>
        <Button type="submit" disabled={!valid || saving}>{saving ? 'Menyimpan...' : 'Simpan pencairan'}</Button>
      </form>}
    </CardContent>
  </Card>;
}
