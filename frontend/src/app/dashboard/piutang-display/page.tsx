'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileDown, Info, ReceiptText, Search } from 'lucide-react';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';

type DisplayRow = {
  id: number;
  tanggal: string;
  tanggal_sp?: string | null;
  nomor_sp?: string | null;
  nama_penerima: string;
  status: string;
  nilaiSisa: number;
  nilaiTerjual: number;
  nilaiTerjualBelumLunas: number;
  nilaiTotal: number;
  adaSisa: boolean;
};

type Summary = {
  totalPiutang: number;
  totalTerjualDisplay: number;
  totalDisplayBelumLunas: number;
};

const limit = 20;

const StatusPill = ({ status }: { status: string }) => {
  const done = status === 'COMPLETED';
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-xs font-black"
      style={{
        background: done ? '#f0fdf4' : '#fff7ed',
        color: done ? '#16a34a' : '#c2410c',
        border: `1px solid ${done ? '#bbf7d0' : '#fed7aa'}`,
      }}
    >
      {done ? 'Selesai' : 'Berjalan'}
    </span>
  );
};

const MetricCard = ({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: 'orange' | 'green' | 'red' | 'slate' }) => {
  const styles = {
    orange: { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' },
    green: { bg: '#f0fdf4', fg: '#15803d', bd: '#bbf7d0' },
    red: { bg: '#fff1f1', fg: '#dc2626', bd: '#fecaca' },
    slate: { bg: '#f8fafc', fg: '#0f172a', bd: '#e2e8f0' },
  }[tone];
  return (
    <div className="rounded-2xl p-4" style={{ background: styles.bg, border: `1px solid ${styles.bd}` }}>
      <div className="text-xs font-black mb-1" style={{ color: '#64748b' }}>{label}</div>
      <div className="text-lg font-black tabular-nums" style={{ color: styles.fg }}>{formatRupiah(value || 0)}</div>
      {sub && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: '#64748b' }}>{sub}</div>}
    </div>
  );
};

export default function PiutangDisplayPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalPiutang: 0, totalTerjualDisplay: 0, totalDisplayBelumLunas: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { tab: 'display', page, limit };
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [from, to, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/keuangan/offline', { params });
      const list = (res.data.list || []) as DisplayRow[];
      setRows(list);
      setSummary(res.data.summary || { totalPiutang: 0, totalTerjualDisplay: 0, totalDisplayBelumLunas: 0 });
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => [
      row.nama_penerima,
      row.nomor_sp,
      row.status,
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [rows, search]);

  const exportCsv = () => {
    const data = [
      ['No', 'Nomor SP', 'Tanggal SP', 'Customer', 'Status', 'Piutang Display', 'Sudah Terjual', 'Laku Belum Lunas', 'Total Nilai'],
      ...filteredRows.map((row, idx) => [
        idx + 1 + (page - 1) * limit,
        row.nomor_sp || '',
        row.tanggal_sp || '',
        row.nama_penerima,
        row.status,
        row.nilaiSisa,
        row.nilaiTerjual,
        row.nilaiTerjualBelumLunas,
        row.nilaiTotal,
      ]),
    ];
    const csv = data.map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `piutang-display-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetDate = () => {
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black mb-3" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
            <ReceiptText className="h-3.5 w-3.5" /> Piutang Display
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#0f172a' }}>Piutang Display</h1>
          <p className="text-sm mt-1 max-w-2xl leading-relaxed" style={{ color: '#64748b' }}>
            Khusus barang display Penjualan Offline. Dasarnya <strong>Surat Pengantar</strong>, bukan Invoice.
            Piutang Display dihitung dari nilai display yang sudah punya SP dan masih tersisa setelah retur.
          </p>
        </div>
        <button onClick={exportCsv} className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}>
          <FileDown className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Piutang Display" value={summary.totalPiutang} sub="Display ber-SP, belum selesai, net retur" tone="orange" />
        <MetricCard label="Sudah Terjual dari Display" value={summary.totalTerjualDisplay} sub="Barang display yang sudah diproses jadi penjualan" tone="green" />
        <MetricCard label="Laku Belum Lunas" value={summary.totalDisplayBelumLunas} sub="Penjualan dari display yang statusnya belum selesai" tone="red" />
      </div>

      <div className="rounded-2xl p-4" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div className="flex gap-3">
          <Info className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#0369a1' }} />
          <div>
            <div className="text-sm font-black mb-1" style={{ color: '#0c4a6e' }}>Cara baca Piutang Display</div>
            <div className="text-sm leading-relaxed" style={{ color: '#0369a1' }}>
              <strong>Piutang Display</strong> muncul saat Surat Pengantar display dibuat. Jika barang display sudah dijual,
              nilainya pindah ke <strong>Sudah Terjual dari Display</strong>. Jika penjualan itu belum selesai, muncul juga di <strong>Laku Belum Lunas</strong>.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
        <div className="p-4 flex flex-col xl:flex-row xl:items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <form onSubmit={e => { e.preventDefault(); }} className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari customer atau nomor SP..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}
            />
          </form>
          <div className="flex flex-col sm:flex-row gap-2">
            <DateInput value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="min-h-[44px] px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
            <DateInput value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="min-h-[44px] px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
            <button onClick={resetDate} className="min-h-[44px] px-4 rounded-xl text-sm font-black" style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}>
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['No', 'Surat Pengantar', 'Customer Display', 'Status', 'Piutang Display', 'Sudah Terjual', 'Laku Belum Lunas', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#94a3b8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Memuat piutang display...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Tidak ada piutang display pada filter ini</td></tr>
              ) : filteredRows.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: '#94a3b8' }}>{idx + 1 + (page - 1) * limit}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-black font-mono" style={{ color: '#2563eb' }}>{row.nomor_sp || '-'}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>SP: {formatDate(row.tanggal_sp)} · Display: {formatDate(row.tanggal)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-black" style={{ color: '#1e293b' }}>{row.nama_penerima}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Penjualan Offline · DISPLAY</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-3 text-sm font-black tabular-nums" style={{ color: '#c2410c' }}>{formatRupiah(row.nilaiSisa)}</td>
                  <td className="px-4 py-3 text-sm font-black tabular-nums" style={{ color: '#15803d' }}>{formatRupiah(row.nilaiTerjual)}</td>
                  <td className="px-4 py-3 text-sm font-black tabular-nums" style={{ color: '#dc2626' }}>{row.nilaiTerjualBelumLunas ? formatRupiah(row.nilaiTerjualBelumLunas) : '-'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/penjualan/offline/${row.id}`} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg text-xs font-black" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                      Buka <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
          <span className="text-xs" style={{ color: '#94a3b8' }}>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="min-h-[36px] px-3 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Sebelumnya</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="min-h-[36px] px-3 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Berikutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
