'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, User, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  href: string;
  category: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  // Fetch results
  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => { setResults(r.data); setOpen(true); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard: Esc closes, Ctrl+K / Cmd+K focuses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  }, [router]);

  // Group results by category
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  const categoryIcon = (cat: string) =>
    cat === 'Dokumen' ? FileText : User;

  const categoryColor: Record<string, string> = {
    'Penjualan Offline': '#059669',
    'Penjualan Interior': '#7c3aed',
    'Dokumen': '#0369a1',
  };

  return (
    <div ref={containerRef} className="relative" style={{ width: dark ? '100%' : 280 }}>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
        style={dark
          ? { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
          : { background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: '#94a3b8' }} />
          : <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#94a3b8' }} />}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Cari… (Ctrl+K)"
          className="flex-1 bg-transparent outline-none text-xs"
          style={{ color: dark ? 'rgba(255,255,255,0.85)' : '#0f172a' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }}>
            <X className="h-3 w-3" style={{ color: '#94a3b8' }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 right-0 rounded-xl overflow-hidden animate-fade-in z-50"
          style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,0.14)', maxHeight: 380, overflowY: 'auto' }}
        >
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: '#94a3b8' }}>
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => {
              const Icon = categoryIcon(cat);
              const color = categoryColor[cat] || '#475569';
              return (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 px-3 py-2 sticky top-0"
                    style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <Icon className="h-3 w-3" style={{ color }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{cat}</span>
                  </div>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all"
                      style={{ borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      onClick={() => handleSelect(item.href)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{item.label}</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>{item.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
