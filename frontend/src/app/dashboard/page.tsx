'use client';
import { useEffect, useState } from 'react';
import { ShoppingCart, Package, TrendingUp, BarChart3, Monitor, ArrowUpRight, Activity, Wallet, AlertCircle, Banknote } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';
import Link from 'next/link';
import { useListSync } from '@/hooks/useListSync';

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ offline: 0, interior: 0, display: 0 });
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState({ omzet: 0, piutang: 0, outstanding: 0 });
  const [financeLoading, setFinanceLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [offRes, intRes, dispRes] = await Promise.all([
        api.get('/penjualan-offline?tipe=PENJUALAN&limit=1'),
        api.get('/penjualan-interior?limit=1'),
        api.get('/penjualan-offline?tipe=DISPLAY&limit=1'),
      ]);
      setStats({
        offline: offRes.data.total || 0,
        interior: intRes.data.total || 0,
        display: dispRes.data.total || 0,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchFinance = async () => {
    try {
      const from = firstOfMonth();
      const to = today();
      const [offRes, intRes] = await Promise.all([
        api.get(`/keuangan/offline?from=${from}&to=${to}&limit=1`),
        api.get(`/keuangan/interior?from=${from}&to=${to}&limit=1`),
      ]);
      setFinance({
        omzet: offRes.data.summary?.totalOmzet || 0,
        piutang: offRes.data.summary?.totalPiutang || 0,
        outstanding: intRes.data.summary?.totalOutstanding || 0,
      });
    } catch {
      // ignore
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => { fetchStats(); fetchFinance(); }, []);
  useListSync('penjualan-offline-list', () => { fetchStats(); fetchFinance(); });
  useListSync('penjualan-interior-list', () => { fetchStats(); fetchFinance(); });

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam';

  const statCards = [
    {
      label: 'Penjualan Offline',
      desc: 'Total transaksi',
      value: stats.offline,
      icon: ShoppingCart,
      color: '#FA2F2F',
      bg: '#fff1f1',
      accent: '#fecaca',
      href: '/dashboard/penjualan/offline',
    },
    {
      label: 'Penjualan Interior',
      desc: 'Total proyek aktif',
      value: stats.interior,
      icon: TrendingUp,
      color: '#0369a1',
      bg: '#f0f9ff',
      accent: '#bae6fd',
      href: '/dashboard/penjualan/interior',
    },
    {
      label: 'Unit Display',
      desc: 'Penjualan display',
      value: stats.display,
      icon: Monitor,
      color: '#0d9488',
      bg: '#f0fdfa',
      accent: '#99f6e4',
      href: '/dashboard/display',
    },
  ];

  const quickActions = [
    {
      label: 'Penjualan Baru',
      desc: 'Buat transaksi offline',
      href: '/dashboard/penjualan/offline/baru',
      icon: ShoppingCart,
    },
    {
      label: 'Display Baru',
      desc: 'Tambah unit display',
      href: '/dashboard/display/baru',
      icon: Package,
    },
    {
      label: 'Interior Baru',
      desc: 'Proyek interior baru',
      href: '/dashboard/penjualan/interior/baru',
      icon: TrendingUp,
    },
    {
      label: 'Master Barang',
      desc: 'Kelola data produk',
      href: '/dashboard/master/barang',
      icon: BarChart3,
    },
  ];

  const total = stats.offline + stats.interior + stats.display;

  return (
    <div className="space-y-6 w-full mt-4 lg:mt-0">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#64748b' }}>
            {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            {greeting}, <span style={{ color: '#FA2F2F' }}>{user?.username}</span>
          </h1>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold self-start sm:self-auto"
          style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative"
          >
             <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
          </div>
          Sistem Online
        </div>
      </div>

      {/* ─── Overview Banner ─── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.1)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px) `,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-2 text-red-200">
              Total Transaksi Sistem
            </p>
            {loading ? (
              <div className="skeleton h-12 w-24 mb-1 bg-white/10 rounded-lg" />
            ) : (
              <div className="text-5xl sm:text-6xl font-black text-white leading-none tracking-tight">
                {total.toLocaleString('id-ID')}
              </div>
            )}
            <p className="text-sm mt-3 text-slate-400">
              Keseluruhan dari semua unit bisnis
            </p>
          </div>

          {/* Quick stats inline for desktop banner */}
          <div className="hidden sm:flex flex-row gap-8 lg:gap-12 pl-8 border-l border-white/10">
            {statCards.map((c) => (
              <div key={c.label}>
                <div className="text-3xl font-bold text-white tracking-tight mb-1">
                  {loading ? '-' : c.value}
                </div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {c.label.replace('Penjualan ', '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group block rounded-2xl p-6 transition-all duration-300 relative overflow-hidden bg-white"
            style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(15,23,42,0.02)' }}
          >
            {/* Hover subtle glow */}
            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-bl-full pointer-events-none" style={{ background: `radial-gradient(circle, ${card.color} 0%, transparent 70%)` }}></div>
            
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{ background: card.bg }}
              >
                <card.icon className="h-6 w-6" style={{ color: card.color }} />
              </div>
              <div className="p-2 rounded-full bg-slate-50 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-slate-100">
                 <ArrowUpRight className="h-4 w-4" style={{ color: card.color }} />
              </div>
            </div>
            
            <div className="relative z-10">
              {loading ? (
                <div className="skeleton h-10 w-20 mb-2 rounded border border-slate-100" />
              ) : (
                <div className="text-4xl font-extrabold mb-1 tracking-tight text-slate-900 group-hover:translate-x-1 transition-transform duration-300">
                  {card.value.toLocaleString('id-ID')}
                </div>
              )}
              <div className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                {card.label}
              </div>
              <div className="text-xs text-slate-400 mt-1">{card.desc}</div>
            </div>

            {/* Bottom colored bar */}
            <div className="absolute bottom-0 left-0 h-1 w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300" style={{ background: card.color }}></div>
          </Link>
        ))}
      </div>

      {/* ─── Keuangan Bulan Ini ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-500" /> Keuangan Bulan Ini
          </h2>
          <Link href="/dashboard/keuangan" className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1">
            Lihat Detail <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Omzet Offline */}
          <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#fff1f1' }}>
                <Banknote className="h-4 w-4" style={{ color: '#FA2F2F' }} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Omzet Offline</span>
            </div>
            {financeLoading ? (
              <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
            ) : (
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">{fmtRp(finance.omzet)}</div>
            )}
            <div className="text-xs text-slate-400 mt-1">Total penjualan offline</div>
          </div>

          {/* Piutang Display */}
          <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#fefce8' }}>
                <AlertCircle className="h-4 w-4" style={{ color: '#ca8a04' }} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Piutang Display</span>
            </div>
            {financeLoading ? (
              <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
            ) : (
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">{fmtRp(finance.piutang)}</div>
            )}
            <div className="text-xs text-slate-400 mt-1">Barang display belum terjual</div>
          </div>

          {/* Outstanding Interior */}
          <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0f9ff' }}>
                <TrendingUp className="h-4 w-4" style={{ color: '#0369a1' }} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding Interior</span>
            </div>
            {financeLoading ? (
              <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
            ) : (
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">{fmtRp(finance.outstanding)}</div>
            )}
            <div className="text-xs text-slate-400 mt-1">Sisa tagihan proyek interior</div>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
           <Activity className="h-4 w-4 text-red-500" /> Akses Cepat
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group block rounded-xl p-5 bg-white transition-all duration-300 hover:-translate-y-1"
              style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300"
                style={{ background: '#f8fafc' }}
              >
                <action.icon
                  className="h-5 w-5 text-slate-500 group-hover:text-red-600 transition-colors duration-300"
                />
              </div>
              <div className="font-semibold text-sm text-slate-800 mb-1 group-hover:text-red-600 transition-colors">
                {action.label}
              </div>
              <div className="text-xs text-slate-400 leading-relaxed">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
