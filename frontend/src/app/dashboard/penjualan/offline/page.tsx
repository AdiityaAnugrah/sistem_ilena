'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus, Search, Eye, FileText, TrendingUp } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:     { label: 'Draft',     cls: 'badge-draft' },
    ACTIVE:    { label: 'Aktif',     cls: 'badge-active' },
    COMPLETED: { label: 'Selesai',  cls: 'badge-completed' },
  };
  const s = map[status] || { label: status, cls: 'badge-draft' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
};

const FakturBadge = ({ faktur }: { faktur: string }) => {
  const isFaktur = faktur === 'FAKTUR';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isFaktur ? 'badge-faktur' : 'badge-nonfaktur'}`}>
      {isFaktur ? 'Faktur' : 'Non Faktur'}
    </span>
  );
};

const SkeletonRow = () => (
  <tr>
    {Array.from({ length: 6 }).map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className="skeleton h-4 rounded" style={{ width: i === 0 ? '80px' : i === 1 ? '120px' : '90px' }} />
      </td>
    ))}
  </tr>
);

export default function PenjualanOfflinePage() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tipeFilter, setTipeFilter] = useState('PENJUALAN');

  const fetchData = async (s = search, p = page, tipe = tipeFilter) => {
    setLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: { search: s, page: p, limit: 20, tipe } });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, tipeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Penjualan Offline
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {total} total transaksi dalam catatan
          </p>
        </div>
        <Link href="/dashboard/penjualan/offline/baru">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-300 shadow-[0_4px_12px_rgba(250,47,47,0.25)] hover:shadow-[0_8px_20px_rgba(250,47,47,0.35)] hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}
          >
            <Plus className="h-4 w-4" />
            Penjualan Baru
          </button>
        </Link>
      </div>

      {/* Card utama */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
        {/* Filter bar */}
        <div className="px-5 py-4 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
          
          {/* Main Filter Array */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
             <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipe Transaksi</label>
             <select
                value={tipeFilter}
                onChange={e => { setTipeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none transition-all cursor-pointer"
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b' }}
                onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
                onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
             >
                <option value="PENJUALAN">Penjualan</option>
                <option value="DISPLAY">Display</option>
             </select>
          </div>

          {/* Search */}
          <form
            onSubmit={e => { e.preventDefault(); setPage(1); fetchData(search, 1); }}
            className="flex gap-2 w-full md:w-auto items-end"
          >
            <div className="relative flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Pencarian</label>
              <Search className="absolute left-3 top-[34px] -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, no. HP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg transition-all duration-150 outline-none md:w-[260px]"
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#334155' }}
                onFocus={e => (e.target as HTMLElement).style.border = '1px solid #FA2F2F'}
                onBlur={e => (e.target as HTMLElement).style.border = '1px solid #e2e8f0'}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm h-[38px]"
              style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = '#fff';
                (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              }}
            >
              Cari
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Tanggal', 'Nama Penerima', 'No. HP', 'Faktur', 'Status', 'Aksi'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#94a3b8' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f8fafc' }}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: '#f1f5f9' }}
                      >
                        <FileText className="h-6 w-6" style={{ color: '#cbd5e1' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Tidak ada data</p>
                    </div>
                  </td>
                </tr>
              ) : data.map((row: any, idx) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-100"
                  style={{ background: '#fff' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafbfc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
                >
                  <td className="px-5 py-4 text-sm" style={{ color: '#64748b' }}>
                    {formatDate(row.tanggal)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold" style={{ color: '#1e293b' }}>
                      {row.nama_penerima}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#64748b' }}>
                    {row.no_hp_penerima}
                  </td>
                  <td className="px-5 py-4">
                    <FakturBadge faktur={row.faktur} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/penjualan/offline/${row.id}`}>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = '#fff1f1';
                          (e.currentTarget as HTMLElement).style.color = '#FA2F2F';
                          (e.currentTarget as HTMLElement).style.border = '1px solid #fecaca';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                          (e.currentTarget as HTMLElement).style.color = '#475569';
                          (e.currentTarget as HTMLElement).style.border = '1px solid #e2e8f0';
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detail
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderTop: '1px solid #f1f5f9' }}
        >
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            Halaman <span className="font-semibold" style={{ color: '#475569' }}>{page}</span> dari{' '}
            <span className="font-semibold" style={{ color: '#475569' }}>{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
            >
              ← Sebelumnya
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
