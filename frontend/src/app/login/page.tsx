'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, ArrowRight, Building2 } from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.token);
      toast.success('Login berhasil!');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>

      {/* ─── Left Panel — Branding ─── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0c1220' }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow accent */}
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              <span className="text-white font-bold text-sm">IL</span>
            </div>
            <div>
              <div className="text-white font-semibold text-base tracking-wide">ILENA</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Sistem Manajemen</div>
            </div>
          </div>
        </div>

        {/* Center: Headline */}
        <div className="relative z-10">
          <div
            className="inline-block text-[11px] font-semibold uppercase tracking-[0.1em] mb-5 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(37,99,235,0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(37,99,235,0.25)',
            }}
          >
            Sistem Manajemen
          </div>
          <h1
            className="text-4xl font-bold leading-tight mb-4"
            style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}
          >
            I L E N A Furniture 
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Penjualan, stok, dan laporan dalam satu platform terintegrasi untuk CV. Catur Bhakti Mandiri.
          </p>

          {/* Feature bullets */}
          <div className="mt-8 space-y-3">
            {[
              'Manajemen penjualan offline & interior',
              'Cetak dokumen surat jalan & invoice',
              'Monitor stok & master barang real-time',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#2563eb' }}
                />
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: copyright */}
        <div className="relative z-10">
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Ilena Furniture · CV. Catur Bhakti Mandiri
          </p>
        </div>
      </div>

      {/* ─── Right Panel — Form ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
          >
            <span className="text-white font-bold text-sm">IL</span>
          </div>
          <div className="font-semibold text-base" style={{ color: '#0f172a' }}>ILENA</div>
        </div>

        <div className="w-full max-w-[360px]">
          {/* Header */}
          <div className="mb-8">
            <h2
              className="text-2xl font-bold mb-1.5"
              style={{ color: '#0f172a', letterSpacing: '-0.02em' }}
            >
              Selamat Datang
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Masuk untuk mengakses sistem manajemen
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: '#64748b' }}
              >
                Username
              </Label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: '#94a3b8' }}
                />
                <Input
                  id="username"
                  placeholder="Masukkan username"
                  className="pl-9 h-10 text-[13.5px] border-slate-200 bg-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  style={{ borderRadius: '0.5rem' }}
                  {...register('username', { required: 'Username wajib diisi' })}
                />
              </div>
              {errors.username && (
                <p className="text-red-500 text-xs">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: '#64748b' }}
              >
                Password
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: '#94a3b8' }}
                />
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan password"
                  className="pl-9 h-10 text-[13.5px] border-slate-200 bg-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  style={{ borderRadius: '0.5rem' }}
                  {...register('password', { required: 'Password wajib diisi' })}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-10 text-white font-semibold text-[13.5px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: loading ? '#3b82f6' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                borderRadius: '0.5rem',
                boxShadow: '0 2px 10px rgba(37,99,235,0.22)',
              }}
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)';
              }}
              onMouseLeave={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(37,99,235,0.22)';
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Memproses...
                </span>
              ) : (
                <>
                  Masuk
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider info */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
              <p className="text-[11.5px] leading-relaxed" style={{ color: '#94a3b8' }}>
                ILENA Furniture · Semarang, Jawa Tengah · Indonesia
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
