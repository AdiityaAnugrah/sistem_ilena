'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { Search, Plus, X, Package } from 'lucide-react';

interface Props {
  onSelect: (barang: any) => void;
}

export default function BarangSelector({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch produk — query kosong = tampilkan semua (limit 20)
  const fetchBarang = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get('/barang', { params: { search: q, limit: 20, active: 1 } });
      setResults(res.data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchBarang('');
  }, [fetchBarang]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBarang(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchBarang]);

  const handleSelect = (barang: any) => {
    onSelect(barang);
    // Tidak reset search bar agar user bisa tambah banyak barang sekaligus jika sedang nyari
  };

  const handleClear = () => {
    setSearch('');
  };

  return (
    <div className="rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col transition-all bg-white shadow-sm hover:shadow-md">
      {/* Header / Input Field */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]"
      >
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
        {search && (
          <button type="button" onClick={handleClear} className="flex-shrink-0 p-1 rounded-md hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Product List Content */}
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
              {search ? `Produk "${search}" tidak ditemukan` : 'Tidak ada produk'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {results.map((barang) => (
              <div
                key={barang.id}
                className="w-full flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 group-hover:bg-blue-50 transition-colors">
                  <Package className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate" title={barang.nama}>
                    {barang.nama}
                  </div>
                  <div className="text-xs mt-1 text-slate-500 font-medium">
                    <span className="text-slate-400">ID: {barang.id}</span>
                    <span className="mx-1.5 opacity-50">•</span>
                    {barang.kategori}
                    {barang.subkategori && <span className="opacity-75"> / {barang.subkategori}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 flex-shrink-0">
                  <span className="text-[15px] font-black text-blue-600 tracking-tight">
                    {formatRupiah(barang.harga)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelect(barang)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
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
