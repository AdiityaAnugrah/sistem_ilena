'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, ArrowRight, Building2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface SetupForm {
  password: string;
  konfirmasi: string;
}

export default function SetupKataSandiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SetupForm>();

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    api.get(`/auth/setup-password?token=${token}`)
      .then(res => {
        setTokenValid(true);
        setUsername(res.data.username);
        setNamaLengkap(res.data.nama_lengkap || '');
      })
      .catch(() => {
        setTokenValid(false);
      })
      .finally(() => setValidating(false));
  }, [token]);

  const onSubmit = async (data: SetupForm) => {
    if (data.password !== data.konfirmasi) {
      toast.error('Konfirmasi kata sandi tidak cocok');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/setup-password', { token, password: data.password });
      setDone(true);
      toast.success('Kata sandi berhasil diatur!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal mengatur kata sandi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>

      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0c1220' }}
      >
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
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.18) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.10) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <img src="/img/logoilena.svg" alt="Ilena Furniture" style={{ height: 36, width: 'auto' }} />
        </div>

        <div className="relative z-10">
          <div
            className="inline-block text-[11px] font-semibold uppercase tracking-[0.1em] mb-5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(5,150,105,0.15)', color: '#6ee7b7', border: '1px solid rgba(5,150,105,0.25)' }}
          >
            Aktivasi Akun
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4"
            style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
            Selamat Bergabung
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Atur kata sandi Anda untuk mulai menggunakan sistem manajemen ILENA Furniture.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Ilena Furniture · CV. Catur Bhakti Mandiri
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">

          {validating ? (
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm" style={{ color: '#64748b' }}>Memverifikasi link aktivasi…</p>
            </div>

          ) : !token || !tokenValid ? (
            <div>
              <div className="flex items-center justify-center w-14 h-14 rounded-full mb-5"
                style={{ background: '#fef2f2' }}>
                <AlertCircle className="h-7 w-7" style={{ color: '#ef4444' }} />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                Link Tidak Valid
              </h2>
              <p className="text-sm mb-6" style={{ color: '#64748b', lineHeight: 1.7 }}>
                Link aktivasi ini tidak valid atau sudah digunakan sebelumnya. Silahkan hubungi administrator untuk mendapatkan link baru.
              </p>
              <button
                onClick={() => router.replace('/login')}
                className="w-full h-10 font-semibold text-[13.5px] transition-all"
                style={{ background: '#f1f5f9', borderRadius: '0.5rem', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                Kembali ke Halaman Login
              </button>
            </div>

          ) : done ? (
            <div>
              <div className="flex items-center justify-center w-14 h-14 rounded-full mb-5"
                style={{ background: '#f0fdf4' }}>
                <CheckCircle className="h-7 w-7" style={{ color: '#059669' }} />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                Kata Sandi Berhasil Diatur
              </h2>
              <p className="text-sm mb-6" style={{ color: '#64748b', lineHeight: 1.7 }}>
                Akun Anda telah aktif. Silahkan login menggunakan username dan kata sandi yang baru saja Anda buat.
              </p>
              <button
                onClick={() => router.replace('/login')}
                className="w-full flex items-center justify-center gap-2 h-10 text-white font-semibold text-[13.5px] transition-all"
                style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: '0.5rem', boxShadow: '0 2px 10px rgba(5,150,105,0.25)' }}
              >
                Masuk ke Sistem <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          ) : (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Atur Kata Sandi
                </h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Halo{namaLengkap ? `, ${namaLengkap}` : username ? `, ${username}` : ''}! Buat kata sandi untuk mengaktifkan akun Anda.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: '#64748b' }}>
                    Kata Sandi Baru
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94a3b8' }} />
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Min. 6 karakter"
                      className="pl-9 pr-10 h-10 text-[13.5px] border-slate-200 bg-white placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                      style={{ borderRadius: '0.5rem' }}
                      {...register('password', { required: 'Kata sandi wajib diisi', minLength: { value: 6, message: 'Minimal 6 karakter' } })}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="konfirmasi" className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: '#64748b' }}>
                    Konfirmasi Kata Sandi
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94a3b8' }} />
                    <Input
                      id="konfirmasi"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Ulangi kata sandi"
                      className="pl-9 pr-10 h-10 text-[13.5px] border-slate-200 bg-white placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                      style={{ borderRadius: '0.5rem' }}
                      {...register('konfirmasi', {
                        required: 'Konfirmasi kata sandi wajib diisi',
                        validate: v => v === watch('password') || 'Kata sandi tidak cocok',
                      })}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.konfirmasi && <p className="text-red-500 text-xs">{errors.konfirmasi.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 h-10 text-white font-semibold text-[13.5px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  style={{
                    background: loading ? '#34d399' : 'linear-gradient(135deg, #059669, #047857)',
                    borderRadius: '0.5rem',
                    boxShadow: '0 2px 10px rgba(5,150,105,0.25)',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Menyimpan…
                    </span>
                  ) : (
                    <>Aktifkan Akun <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
                  <p className="text-[11.5px] leading-relaxed" style={{ color: '#94a3b8' }}>
                    ILENA Furniture · Semarang, Jawa Tengah · Indonesia
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
