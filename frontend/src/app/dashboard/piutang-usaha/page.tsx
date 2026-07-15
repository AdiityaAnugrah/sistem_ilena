'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ExternalLink, FileDown, Paperclip, Search, WalletCards } from 'lucide-react';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';

type Tab = 'rekap' | 'detail';

interface RekapRow {
  customer_key: string;
  nama_key?: string;
  sumber: 'OFFLINE' | 'INTERIOR';
  nama_customer: string;
  saldo_awal: number;
  debit: number;
  kredit: number;
  saldo_akhir: number;
  piutang: number;
  lebih_bayar: number;
  jumlah_transaksi: number;
}

interface DetailRow {
  id: string;
  tanggal: string | null;
  sumber: string;
  jenis: string;
  referensi: string;
  customer: string;
  customer_key: string;
  piutang_key?: string;
  no_po?: string;
  keterangan: string;
  debit: number;
  kredit: number;
  saldo: number;
  bukti_endpoint?: string | null;
  detail_url?: string;
}

const limitRekap = 25;
const limitDetail = 100;
type BadgeTone = 'blue' | 'green' | 'orange' | 'purple' | 'slate' | 'red';
type SummaryCard = [string, number, string, string];

const Badge = ({ children, tone }: { children: React.ReactNode; tone: BadgeTone }) => {
  const map = {
    blue: { bg: '#eff6ff', fg: '#2563eb', bd: '#bfdbfe' },
    green: { bg: '#f0fdf4', fg: '#16a34a', bd: '#bbf7d0' },
    orange: { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' },
    purple: { bg: '#f5f3ff', fg: '#7c3aed', bd: '#ddd6fe' },
    slate: { bg: '#f8fafc', fg: '#475569', bd: '#e2e8f0' },
    red: { bg: '#fff1f1', fg: '#dc2626', bd: '#fecaca' },
  }[tone];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: map.bg, color: map.fg, border: `1px solid ${map.bd}` }}>{children}</span>;
};

function PiutangUsahaContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'rekap');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{
    key: string;
    name: string;
    sumber?: string;
    debit?: number;
    kredit?: number;
    piutang?: number;
    lebih_bayar?: number;
    saldo_akhir?: number;
  } | null>(null);
  const [rekapPage, setRekapPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rekapRows, setRekapRows] = useState<RekapRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [rekapSummary, setRekapSummary] = useState({ saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0, piutang: 0, lebihBayar: 0 });
  const [detailSummary, setDetailSummary] = useState({ saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0 });
  const [rekapTotalPages, setRekapTotalPages] = useState(1);
  const [detailTotalPages, setDetailTotalPages] = useState(1);

  useEffect(() => {
    const key = params.get('customer_key');
    const name = params.get('customer_name');
    const initialTab = params.get('tab') as Tab | null;
    if (initialTab === 'detail') setTab('detail');
    if (key) setSelectedCustomer({ key, name: name || key });
  }, [params]);

  const baseParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (search.trim()) p.search = search.trim();
    return p;
  }, [from, to, search]);

  const fetchRekap = useCallback(async (page = rekapPage) => {
    const res = await api.get('/piutang-usaha/rekap', { params: { ...baseParams, page, limit: limitRekap } });
    setRekapRows(res.data.data || []);
    setRekapSummary(res.data.summary || { saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0, piutang: 0, lebihBayar: 0 });
    setRekapTotalPages(res.data.totalPages || 1);
  }, [baseParams, rekapPage]);

  const fetchDetail = useCallback(async (page = detailPage, customer = selectedCustomer) => {
    const res = await api.get('/piutang-usaha/detail', {
      params: {
        ...baseParams,
        customer_key: customer?.key,
        page,
        limit: limitDetail,
      },
    });
    setDetailRows(res.data.data || []);
    setDetailSummary(res.data.summary || { saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0 });
    setDetailTotalPages(res.data.totalPages || 1);
  }, [baseParams, detailPage, selectedCustomer]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRekap(rekapPage), fetchDetail(detailPage, selectedCustomer)]);
    } finally {
      setLoading(false);
    }
  }, [fetchRekap, fetchDetail, rekapPage, detailPage, selectedCustomer]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetPaging = () => {
    setRekapPage(1);
    setDetailPage(1);
  };

  const openCustomerDetail = (row: RekapRow) => {
    setSelectedCustomer({
      key: row.customer_key,
      name: row.nama_customer,
      sumber: row.sumber,
      debit: row.debit,
      kredit: row.kredit,
      piutang: row.piutang,
      lebih_bayar: row.lebih_bayar,
      saldo_akhir: row.saldo_akhir,
    });
    setDetailPage(1);
    setTab('detail');
  };

  const openBukti = async (endpoint: string) => {
    const res = await api.get(endpoint, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const exportCsv = () => {
    const rows = tab === 'rekap'
      ? [
          ['No', 'Nama Customer', 'Saldo Awal', 'Debit', 'Kredit', 'Saldo Akhir'],
          ...rekapRows.map((r, i) => [i + 1 + (rekapPage - 1) * limitRekap, r.nama_customer, r.saldo_awal, r.debit, r.kredit, r.saldo_akhir]),
        ]
      : [
          ['No', 'Tanggal', 'Customer', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
          ...detailRows.map((r, i) => [i + 1 + (detailPage - 1) * limitDetail, r.tanggal || '', r.customer, r.keterangan, r.debit, r.kredit, r.saldo]),
        ];
    const csv = rows.map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `piutang-usaha-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const jenisTone = (jenis: string): BadgeTone => jenis === 'INVOICE' ? 'red' : jenis === 'PEMBAYARAN' ? 'green' : jenis === 'RETUR' ? 'orange' : 'slate';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black mb-3" style={{ background: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca' }}>
            <WalletCards className="h-3.5 w-3.5" /> Piutang Usaha
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#0f172a' }}>Piutang Usaha</h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: '#64748b' }}>
            Pantau piutang dari invoice, pembayaran, dan retur. Saldo positif ditampilkan sebagai piutang, sedangkan saldo negatif ditampilkan sebagai lebih bayar/uang muka agar tidak membingungkan.
          </p>
        </div>
        <button onClick={exportCsv} className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}>
          <FileDown className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {([
          ['Debit / Invoice', rekapSummary.debit, '#eff6ff', '#2563eb'],
          ['Kredit / Bayar + Retur', rekapSummary.kredit, '#f0fdf4', '#16a34a'],
          ['Total Piutang', rekapSummary.piutang, '#fff1f1', '#dc2626'],
          ['Lebih Bayar / Uang Muka', rekapSummary.lebihBayar, '#fff7ed', '#c2410c'],
          ['Net Saldo', rekapSummary.saldoAkhir, '#f8fafc', '#0f172a'],
        ] as SummaryCard[]).map(([label, value, bg, fg]) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: bg, border: '1px solid #e2e8f0' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#64748b' }}>{label}</div>
            <div className="text-lg font-black tabular-nums" style={{ color: fg }}>{formatRupiah(value || 0)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div className="text-sm font-black mb-1" style={{ color: '#92400e' }}>Catatan akurasi data</div>
        <div className="text-sm leading-relaxed" style={{ color: '#b45309' }}>
          Laporan ini read-only dan tidak mengubah data produksi. Customer dari Penjualan Offline dan Interior sengaja <strong>tidak digabung otomatis</strong> sampai ada master customer.
          Jika kredit lebih besar dari debit, sistem menandainya sebagai <strong>Lebih Bayar / Uang Muka</strong>, bukan piutang minus.
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
        <div className="p-4 flex flex-col xl:flex-row xl:items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="inline-flex p-1 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            {(['rekap', 'detail'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="min-h-[40px] px-4 rounded-lg text-sm font-black transition-colors"
                style={tab === t ? { background: '#FA2F2F', color: '#fff' } : { color: '#64748b' }}
              >
                {t === 'rekap' ? 'Rekap / Summary' : 'Detail'}
              </button>
            ))}
          </div>

          <form onSubmit={e => { e.preventDefault(); resetPaging(); fetchData(); }} className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94a3b8' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); resetPaging(); }} placeholder="Cari customer, no PO, referensi..." className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
          </form>
          <DateInput value={from} onChange={e => { setFrom(e.target.value); resetPaging(); }} className="min-h-[44px] px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
          <DateInput value={to} onChange={e => { setTo(e.target.value); resetPaging(); }} className="min-h-[44px] px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
        </div>

        {tab === 'detail' && selectedCustomer && (
          <div className="px-4 py-4" style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: '#c2410c' }}>
                  Rincian dari baris rekap yang dipilih
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCustomer.sumber && <Badge tone={selectedCustomer.sumber === 'OFFLINE' ? 'blue' : 'purple'}>{selectedCustomer.sumber}</Badge>}
                  <div className="text-sm font-black" style={{ color: '#9a3412' }}>{selectedCustomer.name}</div>
                </div>
                <div className="text-xs mt-1" style={{ color: '#b45309' }}>
                  Detail di bawah menjelaskan asal angka debit, kredit, dan saldo pada rekap customer ini.
                </div>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setDetailPage(1); }} className="min-h-[36px] px-3 rounded-lg text-xs font-black" style={{ background: '#fff', color: '#c2410c', border: '1px solid #fed7aa' }}>
                Lihat Semua Detail
              </button>
            </div>
            {selectedCustomer.debit !== undefined && (
              <div className="mt-3 text-xs leading-relaxed" style={{ color: '#b45309' }}>
                Rumus detail: <strong>Saldo berjalan = Saldo sebelumnya + Debit - Kredit</strong>. 
                Saldo terakhir di detail harus menjelaskan status pada rekap:
                <strong> {(selectedCustomer.saldo_akhir || 0) >= 0 ? `Piutang ${formatRupiah(selectedCustomer.piutang || 0)}` : `Lebih Bayar / Uang Muka ${formatRupiah(selectedCustomer.lebih_bayar || 0)}`}</strong>.
              </div>
            )}
          </div>
        )}

        {tab === 'rekap' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['No', 'Sumber', 'Nama Customer', 'Saldo Awal', 'Debit', 'Kredit', 'Status Saldo', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Memuat rekap piutang...</td></tr>
                ) : rekapRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Tidak ada piutang pada filter ini</td></tr>
                ) : rekapRows.map((row, idx) => (
                  <tr key={row.customer_key} onClick={() => openCustomerDetail(row)} className="cursor-pointer" style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: '#94a3b8' }}>{idx + 1 + (rekapPage - 1) * limitRekap}</td>
                    <td className="px-4 py-3"><Badge tone={row.sumber === 'OFFLINE' ? 'blue' : 'purple'}>{row.sumber}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-black" style={{ color: '#1e293b' }}>{row.nama_customer}</div>
                      <div className="text-xs" style={{ color: '#94a3b8' }}>{row.jumlah_transaksi} transaksi periode ini</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums" style={{ color: '#475569' }}>{formatRupiah(row.saldo_awal)}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums" style={{ color: '#2563eb' }}>{formatRupiah(row.debit)}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums" style={{ color: '#16a34a' }}>{formatRupiah(row.kredit)}</td>
                    <td className="px-4 py-3">
                      {row.saldo_akhir >= 0 ? (
                        <div>
                          <div className="text-xs font-bold" style={{ color: '#dc2626' }}>Piutang</div>
                          <div className="text-sm font-black tabular-nums" style={{ color: '#dc2626' }}>{formatRupiah(row.piutang)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs font-bold" style={{ color: '#c2410c' }}>Lebih Bayar / Uang Muka</div>
                          <div className="text-sm font-black tabular-nums" style={{ color: '#c2410c' }}>{formatRupiah(row.lebih_bayar)}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg text-xs font-black" style={{ background: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca' }}>
                        Detail <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !selectedCustomer ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#fff1f1', color: '#dc2626' }}>
              <WalletCards className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black" style={{ color: '#0f172a' }}>Pilih customer dari Rekap dulu</h2>
            <p className="text-sm mt-2 max-w-xl mx-auto" style={{ color: '#64748b' }}>
              Detail bukan ringkasan lagi. Detail dipakai untuk melihat mutasi invoice, pembayaran, retur, dan saldo berjalan dari satu customer yang dipilih.
            </p>
            <button
              onClick={() => setTab('rekap')}
              className="mt-5 min-h-[44px] px-4 rounded-xl text-sm font-black"
              style={{ background: '#FA2F2F', color: '#fff' }}
            >
              Buka Rekap dan Pilih Customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['No', 'Tanggal', 'Jenis Mutasi', 'Keterangan / Deskripsi', 'Debit', 'Kredit', 'Saldo Berjalan', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Memuat detail piutang...</td></tr>
                ) : detailRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Tidak ada detail piutang</td></tr>
                ) : detailRows.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} style={{ borderBottom: '1px solid #f8fafc', background: row.jenis === 'SALDO_AWAL' ? '#fafafa' : '#fff' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: '#94a3b8' }}>{idx + 1 + (detailPage - 1) * limitDetail}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#64748b' }}>{row.tanggal ? formatDate(row.tanggal) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {row.sumber !== '-' && <Badge tone={row.sumber === 'OFFLINE' ? 'blue' : 'purple'}>{row.sumber}</Badge>}
                        <Badge tone={jenisTone(row.jenis)}>{row.jenis === 'SALDO_AWAL' ? 'SALDO AWAL' : row.jenis}</Badge>
                      </div>
                      <div className="text-xs" style={{ color: '#94a3b8' }}>{row.no_po || '-'}</div>
                    </td>
                    <td className="px-4 py-3 min-w-[300px]">
                      <div className="text-sm font-semibold" style={{ color: '#334155' }}>{row.keterangan}</div>
                      {row.referensi && row.referensi !== '-' && <div className="text-xs font-mono mt-0.5" style={{ color: '#94a3b8' }}>{row.referensi}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums" style={{ color: '#2563eb' }}>{row.debit ? formatRupiah(row.debit) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums" style={{ color: '#16a34a' }}>{row.kredit ? formatRupiah(row.kredit) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-bold" style={{ color: row.saldo >= 0 ? '#dc2626' : '#c2410c' }}>
                        {row.saldo >= 0 ? 'Piutang' : 'Lebih Bayar'}
                      </div>
                      <div className="text-sm font-black tabular-nums" style={{ color: row.saldo >= 0 ? '#dc2626' : '#c2410c' }}>
                        {formatRupiah(Math.abs(row.saldo))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.bukti_endpoint && (
                          <button onClick={() => openBukti(row.bukti_endpoint!)} className="inline-flex items-center gap-1 min-h-[34px] px-2 rounded-lg text-xs font-bold" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                            <Paperclip className="h-3 w-3" /> Bukti
                          </button>
                        )}
                        {row.detail_url && (
                          <Link href={row.detail_url} className="inline-flex items-center gap-1 min-h-[34px] px-2 rounded-lg text-xs font-bold" style={{ background: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca' }}>
                            <ExternalLink className="h-3 w-3" /> Buka
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            Halaman {tab === 'rekap' ? rekapPage : detailPage} dari {tab === 'rekap' ? rekapTotalPages : detailTotalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={(tab === 'rekap' ? rekapPage : detailPage) <= 1} onClick={() => tab === 'rekap' ? setRekapPage(p => Math.max(1, p - 1)) : setDetailPage(p => Math.max(1, p - 1))} className="min-h-[36px] px-3 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Sebelumnya</button>
            <button disabled={(tab === 'rekap' ? rekapPage >= rekapTotalPages : detailPage >= detailTotalPages)} onClick={() => tab === 'rekap' ? setRekapPage(p => Math.min(rekapTotalPages, p + 1)) : setDetailPage(p => Math.min(detailTotalPages, p + 1))} className="min-h-[36px] px-3 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Berikutnya</button>
          </div>
        </div>
      </div>

      {tab === 'detail' && selectedCustomer && (
        <div className="rounded-2xl p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Ringkasan Detail</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div><span style={{ color: '#94a3b8' }}>Saldo Awal</span><div className="font-black" style={{ color: '#0f172a' }}>{formatRupiah(detailSummary.saldoAwal)}</div></div>
            <div><span style={{ color: '#94a3b8' }}>Debit</span><div className="font-black" style={{ color: '#2563eb' }}>{formatRupiah(detailSummary.debit)}</div></div>
            <div><span style={{ color: '#94a3b8' }}>Kredit</span><div className="font-black" style={{ color: '#16a34a' }}>{formatRupiah(detailSummary.kredit)}</div></div>
            <div><span style={{ color: '#94a3b8' }}>{detailSummary.saldoAkhir >= 0 ? 'Saldo Piutang' : 'Lebih Bayar / Uang Muka'}</span><div className="font-black" style={{ color: detailSummary.saldoAkhir >= 0 ? '#dc2626' : '#c2410c' }}>{formatRupiah(Math.abs(detailSummary.saldoAkhir))}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PiutangUsahaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat Piutang Usaha...</div>}>
      <PiutangUsahaContent />
    </Suspense>
  );
}
