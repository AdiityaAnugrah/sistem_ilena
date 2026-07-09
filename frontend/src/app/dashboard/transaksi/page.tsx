'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';
import { BookOpen, ChevronDown, ExternalLink, FileDown, Paperclip, Search } from 'lucide-react';

interface Coa {
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  description?: string;
}

interface Line {
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  kredit: number;
}

interface TransactionRow {
  id: string;
  tanggal: string;
  sumber: 'OFFLINE' | 'INTERIOR';
  jenis: 'INVOICE' | 'PEMBAYARAN' | 'RETUR';
  referensi: string;
  customer: string;
  no_po?: string;
  nilai: number;
  keterangan?: string;
  bukti_endpoint?: string | null;
  detail_url?: string;
  total_debit: number;
  total_kredit: number;
  balanced: boolean;
  lines: Line[];
}

const Badge = ({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'green' | 'orange' | 'purple' | 'red' }) => {
  const map = {
    blue: { bg: '#eff6ff', fg: '#2563eb', bd: '#bfdbfe' },
    green: { bg: '#f0fdf4', fg: '#16a34a', bd: '#bbf7d0' },
    orange: { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' },
    purple: { bg: '#f5f3ff', fg: '#7c3aed', bd: '#ddd6fe' },
    red: { bg: '#fff1f1', fg: '#dc2626', bd: '#fecaca' },
  }[tone];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: map.bg, color: map.fg, border: `1px solid ${map.bd}` }}>{children}</span>;
};

export default function TransaksiPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [coa, setCoa] = useState<Coa[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sumber, setSumber] = useState('');
  const [jenis, setJenis] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [showCoa, setShowCoa] = useState(true);

  const fetchData = async (override: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { search, sumber, jenis, from, to, page, limit: 25, ...override };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const [trxRes, coaRes] = await Promise.all([
        api.get('/transaksi', { params }),
        api.get('/transaksi/coa'),
      ]);
      setRows(trxRes.data.data || []);
      setSummary(trxRes.data.summary || {});
      setTotalPages(trxRes.data.totalPages || 1);
      setCoa(coaRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, sumber, jenis, from, to]);

  const openBukti = async (endpoint: string) => {
    const res = await api.get(endpoint, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const exportCsv = () => {
    const header = ['Tanggal', 'Sumber', 'Jenis', 'Referensi', 'Customer', 'No PO', 'Nilai', 'Debit', 'Kredit', 'Balanced'];
    const body = rows.map(r => [r.tanggal, r.sumber, r.jenis, r.referensi, r.customer, r.no_po || '', r.nilai, r.total_debit, r.total_kredit, r.balanced ? 'YA' : 'TIDAK']);
    const csv = [header, ...body].map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const coaByType = useMemo(() => coa.reduce((acc: Record<string, Coa[]>, row) => {
    if (!acc[row.type]) acc[row.type] = [];
    acc[row.type].push(row);
    return acc;
  }, {}), [coa]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#0f172a' }}>Transaksi & COA</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Ledger debit-kredit dari invoice, pembayaran, dan retur offline/interior.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}>
          <FileDown className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ['Total Invoice', summary.totalInvoice, '#eff6ff', '#2563eb'],
          ['Total Pembayaran', summary.totalPembayaran, '#f0fdf4', '#16a34a'],
          ['Total Retur', summary.totalRetur, '#fff7ed', '#c2410c'],
          ['Total Debit', summary.totalDebit, '#f8fafc', '#0f172a'],
          ['Outstanding Est.', summary.selisihInvoicePembayaran, '#fff1f1', '#dc2626'],
        ].map(([label, value, bg, fg]: any) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: bg, border: '1px solid #e2e8f0' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#64748b' }}>{label}</div>
            <div className="text-lg font-black" style={{ color: fg }}>{formatRupiah(value || 0)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
        <div className="p-4 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData({ page: 1 }); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari customer, no PO, referensi..." className="pl-9 pr-3 py-2 rounded-xl text-sm outline-none" style={{ width: 280, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
          </form>
          <select value={sumber} onChange={e => { setSumber(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>
            <option value="">Semua Sumber</option>
            <option value="OFFLINE">Offline</option>
            <option value="INTERIOR">Interior</option>
          </select>
          <select value={jenis} onChange={e => { setJenis(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>
            <option value="">Semua Jenis</option>
            <option value="INVOICE">Invoice</option>
            <option value="PEMBAYARAN">Pembayaran</option>
            <option value="RETUR">Retur</option>
          </select>
          <DateInput value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
          <DateInput value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Tanggal', 'Sumber', 'Jenis', 'Referensi', 'Customer', 'Nilai', 'Debit', 'Kredit', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Memuat transaksi...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-sm" style={{ color: '#94a3b8' }}>Tidak ada transaksi</td></tr>
              ) : rows.map(row => (
                <>
                  <tr key={row.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: '#64748b' }}>{formatDate(row.tanggal)}</td>
                    <td className="px-4 py-3"><Badge tone={row.sumber === 'OFFLINE' ? 'blue' : 'purple'}>{row.sumber}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={row.jenis === 'PEMBAYARAN' ? 'green' : row.jenis === 'RETUR' ? 'orange' : 'red'}>{row.jenis}</Badge></td>
                    <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: '#334155' }}>{row.referensi}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold" style={{ color: '#1e293b' }}>{row.customer || '-'}</div>
                      <div className="text-xs" style={{ color: '#94a3b8' }}>{row.no_po || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: '#0f172a' }}>{formatRupiah(row.nilai)}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#2563eb' }}>{formatRupiah(row.total_debit)}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#16a34a' }}>{formatRupiah(row.total_kredit)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setOpenRows(prev => ({ ...prev, [row.id]: !prev[row.id] }))} className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                          Detail
                        </button>
                        {row.bukti_endpoint && (
                          <button onClick={() => openBukti(row.bukti_endpoint!)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                            <Paperclip className="h-3 w-3" /> Bukti
                          </button>
                        )}
                        {row.detail_url && (
                          <Link href={row.detail_url} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca' }}>
                            <ExternalLink className="h-3 w-3" /> Buka
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                  {openRows[row.id] && (
                    <tr>
                      <td colSpan={9} className="px-4 py-3" style={{ background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                        <div className="mb-2 text-xs font-bold" style={{ color: '#64748b' }}>{row.keterangan} · Balance: {row.balanced ? 'YA' : 'TIDAK'}</div>
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                          {row.lines.map((l, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs" style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                              <div className="col-span-2 font-mono font-bold" style={{ color: '#475569' }}>{l.account_code}</div>
                              <div className="col-span-4 font-semibold" style={{ color: '#1e293b' }}>{l.account_name}</div>
                              <div className="col-span-2" style={{ color: '#94a3b8' }}>{l.account_type}</div>
                              <div className="col-span-2 text-right font-bold" style={{ color: '#2563eb' }}>{l.debit ? formatRupiah(l.debit) : '-'}</div>
                              <div className="col-span-2 text-right font-bold" style={{ color: '#16a34a' }}>{l.kredit ? formatRupiah(l.kredit) : '-'}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
          <span className="text-xs" style={{ color: '#94a3b8' }}>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Sebelumnya</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Berikutnya</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
        <button onClick={() => setShowCoa(v => !v)} className="w-full px-5 py-4 flex items-center justify-between" style={{ borderBottom: showCoa ? '1px solid #f1f5f9' : 'none' }}>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: '#FA2F2F' }} />
            <h2 className="text-sm font-black" style={{ color: '#1e293b' }}>Chart of Accounts (COA)</h2>
          </div>
          <ChevronDown className="h-4 w-4" style={{ color: '#94a3b8', transform: showCoa ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>
        {showCoa && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Object.entries(coaByType).map(([type, list]) => (
              <div key={type} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                <div className="px-3 py-2 text-xs font-black uppercase" style={{ background: '#f8fafc', color: '#64748b' }}>{type}</div>
                {list.map(c => (
                  <div key={c.code} className="px-3 py-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-black" style={{ color: '#0f172a' }}>{c.code}</span>
                      <Badge tone={c.normal_balance === 'DEBIT' ? 'blue' : 'green'}>{c.normal_balance}</Badge>
                    </div>
                    <div className="text-xs font-bold mt-1" style={{ color: '#334155' }}>{c.name}</div>
                    {c.description && <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{c.description}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
