'use client';
import { useState } from 'react';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api.js';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  CircularProgress,
  Chip,
  Divider,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, Save } from 'lucide-react';

const ROLE_LABEL: Record<string, { label: string; color: 'error' | 'secondary' | 'primary' | 'default' }> = {
  DEV: { label: 'Developer', color: 'error' },
  SUPER_ADMIN: { label: 'Super Admin', color: 'secondary' },
  ADMIN: { label: 'Admin', color: 'primary' },
  PENGGUNA: { label: 'Pengguna', color: 'default' },
  TEST: { label: 'Testing', color: 'default' },
};

export default function ProfilPage() {
  const { user, updateUser } = useAuthStore((s) => ({ user: s.user, updateUser: s.updateUser }));

  const [infoForm, setInfoForm] = useState({
    nama_lengkap: (user as any)?.nama_lengkap || '',
    email: (user as any)?.email || '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const roleConfig = ROLE_LABEL[(user as any)?.role] ?? { label: (user as any)?.role, color: 'default' };

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const res = await api.patch('/auth/profile', {
        nama_lengkap: infoForm.nama_lengkap,
        email: infoForm.email,
      });
      updateUser(res.data.user);
      toast.success('Profil berhasil diperbarui.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui profil.');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }
    setSavingPw(true);
    try {
      await api.patch('/auth/profile', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password berhasil diganti.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengganti password.');
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2, sm: 0 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ color: '#0f172a', letterSpacing: '-0.3px', fontWeight: 700 }}>
          Profil Akun
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
          Kelola informasi akun dan keamanan Anda
        </Typography>
      </Box>

      {/* Info Akun (readonly) */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, mb: 3, borderColor: '#e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={22} color="#fff" />
          </Box>
          <Box>
            <Typography sx={{ color: '#0f172a', lineHeight: 1.3, fontWeight: 700 }}>
              {(user as any)?.username}
            </Typography>
            <Chip
              label={roleConfig.label}
              color={roleConfig.color}
              size="small"
              sx={{ mt: 0.5, fontWeight: 600, fontSize: 11 }}
            />
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldCheck size={15} color="#94a3b8" />
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Username tidak dapat diubah
          </Typography>
        </Box>
      </Paper>

      {/* Form Edit Info */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, mb: 3, borderColor: '#e2e8f0' }}>
        <Typography sx={{ color: '#0f172a', mb: 0.5, fontWeight: 700 }}>
          Informasi Pribadi
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
          Perbarui nama lengkap dan alamat email Anda
        </Typography>
        <form onSubmit={handleSaveInfo}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nama Lengkap"
              value={infoForm.nama_lengkap}
              onChange={(e) => setInfoForm((f) => ({ ...f, nama_lengkap: e.target.value }))}
              size="small"
              fullWidth
              placeholder="Masukkan nama lengkap"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <User size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Email"
              type="email"
              value={infoForm.email}
              onChange={(e) => setInfoForm((f) => ({ ...f, email: e.target.value }))}
              size="small"
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Mail size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={savingInfo}
                startIcon={savingInfo ? <CircularProgress size={14} color="inherit" /> : <Save size={15} />}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
              >
                {savingInfo ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>

      {/* Form Ganti Password */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, borderColor: '#e2e8f0' }}>
        <Typography sx={{ color: '#0f172a', mb: 0.5, fontWeight: 700 }}>
          Ganti Password
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
          Gunakan password yang kuat dan belum pernah dipakai di tempat lain
        </Typography>
        <form onSubmit={handleChangePassword}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Password Lama"
              type={showCurrent ? 'text' : 'password'}
              value={pwForm.current_password}
              onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
              size="small"
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowCurrent((v) => !v)} edge="end">
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password Baru"
              type={showNew ? 'text' : 'password'}
              value={pwForm.new_password}
              onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
              size="small"
              fullWidth
              required
              helperText="Minimal 6 karakter"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNew((v) => !v)} edge="end">
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Konfirmasi Password Baru"
              type={showConfirm ? 'text' : 'password'}
              value={pwForm.confirm_password}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm_password: e.target.value }))}
              size="small"
              fullWidth
              required
              error={pwForm.confirm_password.length > 0 && pwForm.confirm_password !== pwForm.new_password}
              helperText={
                pwForm.confirm_password.length > 0 && pwForm.confirm_password !== pwForm.new_password
                  ? 'Password tidak cocok'
                  : ''
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={savingPw}
                startIcon={savingPw ? <CircularProgress size={14} color="inherit" /> : <Lock size={15} />}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
              >
                {savingPw ? 'Menyimpan...' : 'Ganti Password'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
