'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { Search, Plus, X, Package, Filter } from 'lucide-react';

interface Props {
  onSelect: (barang: any) => void;
}

function parseDimensi(deskripsi: any): string {
  try {
    const d = typeof deskripsi === 'string' ? JSON.parse(deskripsi) : deskripsi;
    if (d?.dimensi?.asli) {
      const { panjang, lebar, tinggi } = d.dimensi.asli;
      const parts = [panjang, lebar, tinggi].filter(v => v && Number(v) > 0);
      if (parts.length > 0) return parts.join(' × ') + ' mm';
    }
  } catch { /* */ }
  return '';
}

export default function BarangSelector({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('');
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBarang = useCallback(async (q: string, kat: string) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 30, active: 1 };
      if (q.trim()) params.search = q.trim();
      if (kat) params.kategori = kat;
      const res = await api.get('/barang', { params });
      const data = res.data.data || [];
      setResults(data);
      // Kumpulkan kategori unik untuk filter dropdown
      setKategoriList(prev => {
        const cats = data.map((b: any) => b.kategori).filter(Boolean);
        return Array.from(new Set([...prev, ...cats])).sort();
      });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchBarang('', '');
  }, [fetchBarang]);

  // Debounce search + kategori
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBarang(search, kategori), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, kategori, fetchBarang]);

  const handleSelect = (barang: any) => {
    onSelect(barang);
  };

  const hasFilter = search || kategori;

  return (
    <div className="rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col transition-all bg-white shadow-sm hover:shadow-md">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
        {loading
          ? <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-transparent animate-spin flex-shrink-0" />
          : <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
        }
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari produk berdasarkan ID, Nama, atau Kategori..."
          className="flex-1 bg-transparent text-sm outline-none font-medium placeholder-slate-400"
          style={{ color: '#1e293b' }}
        />
        {hasFilter && (
          <button type="button" onClick={() => { setSearch(''); setKategori(''); }}
            className="flex-shrink-0 p-1 rounded-md hover:bg-slate-200 transition-colors" title="Reset filter">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#e2e8f0] bg-[#f8fafc]">
        <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setKategori('')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: kategori === '' ? '#FA2F2F' : '#f1f5f9',
              color: kategori === '' ? '#fff' : '#64748b',
            }}
          >
            Semua
          </button>
          {kategoriList.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setKategori(k === kategori ? '' : k)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all uppercase"
              style={{
                background: kategori === k ? '#FA2F2F' : '#f1f5f9',
                color: kategori === k ? '#fff' : '#64748b',
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="max-h-64 overflow-y-auto custom-scrollbar bg-white">
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-10 gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-slate-700 border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-slate-500">Mencari produk...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              {hasFilter ? 'Produk tidak ditemukan' : 'Tidak ada produk'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {results.map((barang) => (
              <div
                key={barang.id}
                className="w-full flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 group-hover:bg-red-50 transition-colors">
                  <Package className="h-5 w-5 text-slate-400 group-hover:text-red-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] lg:text-sm font-semibold text-slate-800 truncate uppercase" title={barang.nama}>
                    {barang.nama}
                  </div>
                  <div className="text-xs mt-1 text-slate-500 font-medium">
                    <span className="text-slate-400">ID: {barang.id}</span>
                    <span className="mx-1.5 opacity-50">•</span>
                    {barang.kategori}
                    {barang.subkategori && <span className="opacity-75"> / {barang.subkategori}</span>}
                    {parseDimensi(barang.deskripsi) && (
                      <>
                        <span className="mx-1.5 opacity-50">•</span>
                        <span className="font-mono text-slate-500">{parseDimensi(barang.deskripsi)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 flex-shrink-0">
                  <span className="text-sm lg:text-[15px] font-bold text-red-600 tracking-tight">
                    {formatRupiah(barang.harga)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelect(barang)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 transition-all active:scale-95 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pilih
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
