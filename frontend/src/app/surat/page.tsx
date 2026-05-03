'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pagination, CircularProgress } from '@mui/material';
import { Search, FileText, ChevronRight, SlidersHorizontal, X } from 'lucide-react';

interface SuratItem {
  nomor: string;
  tipe: string;
  tanggal: string;
  nama_penerima: string;
  sumber: 'OFFLINE' | 'INTERIOR';
  penjualan_id: number;
}

const TIPE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Surat Jalan':          { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  'Invoice':              { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  'Surat Pengantar':      { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  'Sub Surat Pengantar':  { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  'Proforma':             { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' },
  'Sub Invoice':          { bg: '#fdf4ff', color: '#86198f', border: '#e879f9' },
};

const SUMBER_TIPE_OPTIONS = [
  'Surat Jalan', 'Invoice', 'Surat Pengantar', 'Sub Surat Pengantar', 'Proforma', 'Sub Invoice',
];

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function SemuaSuratPage() {
  const router = useRouter();
  const [data, setData] = useState<SuratItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipeFilter, setTipeFilter] = useState('');
  const [sumberFilter, setSumberFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async (p: number, s: string, t: string, sb: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: '20',
        ...(s ? { search: s } : {}),
        ...(t ? { tipe: t } : {}),
        ...(sb ? { sumber: sb } : {}),
      });
      const res = await fetch(`${API}/api/public/surat?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(page, search, tipeFilter, sumberFilter); }, [page, fetchData]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); fetchData(1, v, tipeFilter, sumberFilter); };
  const handleTipe = (v: string) => { setTipeFilter(v); setPage(1); fetchData(1, search, v, sumberFilter); };
  const handleSumber = (v: string) => { setSumberFilter(v); setPage(1); fetchData(1, search, tipeFilter, v); };
  const clearAll = () => { setTipeFilter(''); setSumberFilter(''); setSearch(''); setPage(1); fetchData(1, '', '', ''); };

  const activeFilterCount = [tipeFilter, sumberFilter, search].filter(Boolean).length;

  const formatTgl = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <style>{`
        .sf-search-wrap {
          position: relative; display: flex; align-items: center;
          background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
          padding: 0 12px; gap: 8px; height: 46px;
          transition: border-color 0.15s;
        }
        .sf-search-wrap:focus-within { border-color: #FA2F2F; }
        .sf-search-input {
          flex: 1; border: none; outline: none; background: transparent;
          font-size: 14px; color: #0f172a; min-width: 0;
        }
        .sf-search-input::placeholder { color: #94a3b8; }
        .sf-filter-row { display: flex; gap: 8px; margin-top: 8px; }
        .sf-select {
          flex: 1; height: 40px; border: 1.5px solid #e2e8f0; border-radius: 10px;
          background: #fff; font-size: 13px; color: #0f172a; padding: 0 10px;
          outline: none; cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
          padding-right: 28px;
        }
        .sf-select:focus { border-color: #FA2F2F; }
        .sf-select-active { border-color: #FA2F2F; background-color: #fff1f1; color: #c41c1c; }

        .sf-active-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .sf-chip {
          display: inline-flex; align-items: center; gap: 4px;
          background: #fef2f2; border: 1px solid #fca5a5; color: #c41c1c;
          border-radius: 20px; padding: 3px 10px 3px 10px; font-size: 12px; font-weight: 600;
          cursor: pointer;
        }
        .sf-chip-x { opacity: 0.6; }

        .sc-card {
          background: #fff; border: 1px solid #e8edf3; border-radius: 14px;
          display: flex; align-items: stretch; overflow: hidden;
          cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .sc-card:active { background: #fafbfc; }
        .sc-card-left { width: 4px; flex-shrink: 0; }
        .sc-card-body { flex: 1; min-width: 0; padding: 11px 12px 11px 12px; display: flex; align-items: center; gap: 10px; }
        .sc-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sc-nomor { font-weight: 700; font-size: 13px; color: #0f172a; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sc-meta { font-size: 11px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sc-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
        .sc-arrow { padding: 0 12px; display: flex; align-items: center; }

        .sf-filter-toggle {
          height: 46px; min-width: 46px; border: 1.5px solid #e2e8f0; border-radius: 12px;
          background: #fff; display: flex; align-items: center; justify-content: center; gap: 5px;
          cursor: pointer; font-size: 13px; font-weight: 600; color: #475569; flex-shrink: 0;
          padding: 0 12px; -webkit-tap-highlight-color: transparent;
        }
        .sf-filter-toggle-active { border-color: #FA2F2F; background: #fff1f1; color: #c41c1c; }

        @media (min-width: 480px) {
          .sc-nomor { font-size: 13.5px; }
          .sc-meta { font-size: 11.5px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Semua Dokumen</h1>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0', fontWeight: 500 }}>{loading ? '…' : `${total} dokumen`}</p>
      </div>

      {/* Search + Filter toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="sf-search-wrap" style={{ flex: 1 }}>
          <Search size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
          <input
            className="sf-search-input"
            type="search"
            placeholder="Cari nomor / nama…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => handleSearch('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>
        <button
          className={`sf-filter-toggle ${activeFilterCount > 0 ? 'sf-filter-toggle-active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal size={15} />
          {activeFilterCount > 0 && (
            <span style={{ background: '#FA2F2F', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter dropdowns (expandable) */}
      {showFilters && (
        <div className="sf-filter-row">
          <select
            className={`sf-select ${sumberFilter ? 'sf-select-active' : ''}`}
            value={sumberFilter}
            onChange={e => handleSumber(e.target.value)}
          >
            <option value="">Semua Sumber</option>
            <option value="OFFLINE">Offline</option>
            <option value="INTERIOR">Interior</option>
          </select>
          <select
            className={`sf-select ${tipeFilter ? 'sf-select-active' : ''}`}
            value={tipeFilter}
            onChange={e => handleTipe(e.target.value)}
          >
            <option value="">Semua Tipe</option>
            {SUMBER_TIPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Active filter chips */}
      {(tipeFilter || sumberFilter) && (
        <div className="sf-active-chips">
          {sumberFilter && (
            <button className="sf-chip" onClick={() => handleSumber('')}>
              {sumberFilter} <X size={10} className="sf-chip-x" />
            </button>
          )}
          {tipeFilter && (
            <button className="sf-chip" onClick={() => handleTipe('')}>
              {tipeFilter} <X size={10} className="sf-chip-x" />
            </button>
          )}
          {(tipeFilter && sumberFilter) && (
            <button className="sf-chip" style={{ background: 'transparent', borderColor: '#cbd5e1', color: '#64748b' }} onClick={clearAll}>
              Hapus semua
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <CircularProgress size={26} sx={{ color: '#FA2F2F' }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
            <FileText size={32} color="#e2e8f0" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Tidak ada dokumen</div>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} style={{ marginTop: 10, background: 'none', border: 'none', color: '#FA2F2F', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map(item => {
              const ts = TIPE_STYLE[item.tipe] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
              return (
                <div
                  key={`${item.sumber}-${item.nomor}`}
                  className="sc-card"
                  onClick={() => router.push(`/surat/${item.sumber}/${item.penjualan_id}`)}
                >
                  <div className="sc-card-left" style={{ background: ts.color }} />
                  <div className="sc-card-body">
                    <div className="sc-icon" style={{ background: ts.bg }}>
                      <FileText size={14} color={ts.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sc-nomor">{item.nomor}</div>
                      <div className="sc-meta">{item.nama_penerima} · {formatTgl(item.tanggal)}</div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <span className="sc-badge" style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                          {item.tipe}
                        </span>
                        <span className="sc-badge" style={{
                          background: item.sumber === 'OFFLINE' ? '#eff6ff' : '#f0fdf4',
                          color: item.sumber === 'OFFLINE' ? '#2563eb' : '#15803d',
                          border: `1px solid ${item.sumber === 'OFFLINE' ? '#bfdbfe' : '#bbf7d0'}`,
                        }}>
                          {item.sumber}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} color="primary" size="small" />
        </div>
      )}

      <div style={{ height: 'max(20px, env(safe-area-inset-bottom))' }} />
    </div>
  );
}
