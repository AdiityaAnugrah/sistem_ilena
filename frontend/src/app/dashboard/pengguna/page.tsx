'use client';
import { useEffect, useState } from 'react';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api.js';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  UserPlus,
  Pencil,
  Trash2,
  UserCheck,
  UserMinus,
  Mail,
  User,
  Shield,
} from 'lucide-react';

interface UserRow {
  id: number;
  username: string;
  nama_lengkap: string | null;
  email: string;
  role: 'DEV' | 'SUPER_ADMIN' | 'ADMIN' | 'PENGGUNA' | 'TEST';
  active: number;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { color: "error" | "secondary" | "primary" | "default", label: string }> = {
  DEV: { color: 'error', label: 'Developer' },
  SUPER_ADMIN: { color: 'secondary', label: 'Super Admin' },
  ADMIN: { color: 'primary', label: 'Admin' },
  PENGGUNA: { color: 'default', label: 'Pengguna' },
  TEST: { color: 'default', label: 'Testing' },
};

const emptyForm = { username: '', nama_lengkap: '', email: '', password: '', role: 'PENGGUNA' as UserRow['role'] };

export default function PenggunaPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowedRoles: UserRow['role'][] =
    me?.role === 'DEV'
      ? ['DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA', 'TEST']
      : ['ADMIN', 'PENGGUNA'];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setForm({
      username: u.username,
      nama_lengkap: u.nama_lengkap || '',
      email: u.email,
      password: '',
      role: u.role,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.role) {
      toast.error('Username, email, dan role wajib diisi');
      return;
    }
    if (!editTarget && !form.password.trim()) {
      toast.error('Password wajib diisi untuk user baru');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        username: form.username,
        email: form.email,
        role: form.role,
      };
      if (form.nama_lengkap.trim()) payload.nama_lengkap = form.nama_lengkap;
      if (form.password.trim()) payload.password = form.password;

      if (editTarget) {
        await api.put(`/users/${editTarget.id}`, payload);
        toast.success('User berhasil diupdate');
      } else {
        await api.post('/users', payload);
        toast.success('User berhasil dibuat');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      const res = await api.patch(`/users/${u.id}/toggle-active`);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal mengubah status user');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success(`User ${deleteTarget.username} berhasil dihapus`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal menghapus user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4, lg: 6 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
            Manajemen Pengguna
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kelola akses dan hak istimewa pengguna sistem
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserPlus size={18} />}
          onClick={openAdd}
          sx={{
            py: 1.2,
            px: 3,
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
        >
          Tambah Pengguna
        </Button>
      </Box>

      {/* Main Table Container */}
      <TableContainer component={Paper} sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: 'rgba(241, 245, 249, 0.6)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nama Lengkap</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                  <CircularProgress size={30} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">Memuat daftar pengguna...</Typography>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                  <Typography variant="body2" color="text.secondary">Belum ada pengguna terdaftar.</Typography>
                </TableCell>
              </TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', fontSize: '0.875rem', fontWeight: 700 }}>
                      {u.username[0].toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{u.username}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {u.nama_lengkap || <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic', textTransform: 'none' }}>Tidak Ada Data</Box>}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Mail size={14} style={{ opacity: 0.4 }} />
                    <Typography variant="body2">{u.email}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={ROLE_CONFIG[u.role]?.label || u.role}
                    color={ROLE_CONFIG[u.role]?.color || 'default'}
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: '6px' }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={u.active ? 'Aktif' : 'Nonaktif'}
                    color={u.active ? 'success' : 'error'}
                    sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Tooltip title="Edit Pengguna">
                      <IconButton size="small" onClick={() => openEdit(u)} sx={{ color: 'primary.main' }}>
                        <Pencil size={18} />
                      </IconButton>
                    </Tooltip>
                      <Tooltip title={u.active ? "Nonaktifkan" : "Aktifkan"}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            disabled={u.id === me?.id}
                            onClick={() => handleToggleActive(u)}
                            sx={{ color: u.active ? 'warning.main' : 'success.main' }}
                          >
                            {u.active ? <UserMinus size={18} /> : <UserCheck size={18} />}
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title="Hapus Permanen">
                        <Box component="span">
                          <IconButton
                            size="small"
                            disabled={u.id === me?.id}
                            onClick={() => setDeleteTarget(u)}
                            sx={{ color: 'error.main' }}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </Box>
                      </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Save/Edit Dialog */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: '20px', p: 1 } }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {editTarget ? 'Edit Informasi Pengguna' : 'Tambah Pengguna Sistem'}
        </DialogTitle>
        <DialogContent>
          <Box 
            component="form" 
            onSubmit={(e) => { e.preventDefault(); handleSave(); }} 
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}
          >
            <TextField
              fullWidth
              label="Username"
              size="small"
              required
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              slotProps={{
                input: {
                  startAdornment: <User size={16} style={{ marginRight: 8, opacity: 0.5 }} />
                }
              }}
            />
            <TextField
              fullWidth
              label="Nama Lengkap"
              size="small"
              value={form.nama_lengkap}
              onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              size="small"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              slotProps={{
                input: {
                  startAdornment: <Mail size={16} style={{ marginRight: 8, opacity: 0.5 }} />
                }
              }}
            />
            <TextField
              fullWidth
              label={editTarget ? "Reset Password" : "Password"}
              type="password"
              size="small"
              required={!editTarget}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editTarget ? 'Kosongkan jika tak diubah' : 'Min. 6 karakter'}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="role-select-label">Akses / Role</InputLabel>
              <Select
                labelId="role-select-label"
                value={form.role}
                label="Akses / Role"
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRow['role'] }))}
                startAdornment={<Shield size={16} style={{ marginLeft: 4, marginRight: 8, opacity: 0.5 }} />}
              >
                {allowedRoles.map(r => (
                  <MenuItem key={r} value={r} sx={{ fontSize: '0.875rem' }}>{ROLE_CONFIG[r]?.label || r}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit" sx={{ fontWeight: 600 }}>Batal</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            sx={{ px: 4, borderRadius: '10px' }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Simpan User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        slotProps={{
          paper: { sx: { borderRadius: '16px', maxWidth: 360 } }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pt: 4 }}>Hapus Akun?</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Apakah Anda yakin ingin menghapus akun <strong>{deleteTarget?.username}</strong>? Tindakan ini permanen dan tidak dapat dibatalkan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 3, px: 3, justifyContent: 'center', gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} color="inherit" sx={{ fontWeight: 600 }}>Batal</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            sx={{ px: 3, borderRadius: '10px' }}
          >
            {deleting ? 'Menghapus...' : 'Hapus Akun'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
