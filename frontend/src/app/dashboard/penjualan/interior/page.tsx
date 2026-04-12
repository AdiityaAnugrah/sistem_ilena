'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Eye } from 'lucide-react';

const statusColors: Record<string, any> = { DRAFT: 'secondary', ACTIVE: 'default', COMPLETED: 'outline' };

export default function PenjualanInteriorPage() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = async (s = search, p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/penjualan-interior', { params: { search: s, page: p, limit: 20 } });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Penjualan Interior
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {total} total proyek interior aktif
          </p>
        </div>
        <Link href="/dashboard/penjualan/interior/baru">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_8px_20px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
          >
            <Plus className="h-4 w-4" />
            Interior Baru
          </button>
        </Link>
      </div>

      {/* Card utama */}
      <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
        {/* Filter bar */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1"></div> {/* Empty space filler if there are no select filters here */}
          
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
                placeholder="Cari customer, No. PO..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg transition-all duration-150 outline-none md:w-[280px]"
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#334155' }}
                onFocus={e => (e.target as HTMLElement).style.border = '1px solid #2563eb'}
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

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Tanggal</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">No. PO</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Nama Customer</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">No. HP</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Faktur</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">Tidak ada data transaksi.</td></tr>
              ) : data.map((row: any) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-100 hover:bg-slate-50"
                >
                  <td className="px-5 py-4 text-slate-500">{formatDate(row.tanggal)}</td>
                  <td className="px-5 py-4 font-mono text-slate-600">{row.no_po}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{row.nama_customer}</td>
                  <td className="px-5 py-4 text-slate-500">{row.no_hp}</td>
                  <td className="px-5 py-4">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.faktur === 'FAKTUR' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}
                     </span>
                  </td>
                  <td className="px-5 py-4">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        row.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                        row.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-600'
                     }`}>
                        {row.status === 'COMPLETED' ? 'Selesai' : row.status === 'ACTIVE' ? 'Aktif' : 'Draft'}
                     </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/penjualan/interior/${row.id}`}>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent"
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
          className="px-5 py-4 flex items-center justify-between border-t border-slate-100"
        >
          <p className="text-xs text-slate-500">
            Halaman <span className="font-semibold text-slate-700">{page}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              ← Sebelumnya
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
