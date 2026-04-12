# User Management (Pengguna) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fitur manajemen pengguna khusus DEV dan SUPER_ADMIN, termasuk role baru SUPER_ADMIN dan PENGGUNA.

**Architecture:** Backend menambahkan route `/api/users` dengan guard `requireDevOrSuperAdmin`; SUPER_ADMIN hanya bisa melihat/kelola role ADMIN dan PENGGUNA (tidak tahu DEV ada). Frontend menambahkan halaman `/dashboard/pengguna` dengan tabel + modal tambah/edit, tombol toggle-active, dan tombol hapus.

**Tech Stack:** Node.js + Express + Sequelize + MySQL, Next.js App Router + MUI + Tailwind, axios `api` instance dari `@/lib/api.js`, `react-hot-toast` untuk notifikasi.

---

## File Structure

**Backend:**
- Modify: `backend/src/models/User.js` — tambah `nama_lengkap`, update ENUM role
- Modify: `backend/src/middleware/auth.js` — tambah `requireDevOrSuperAdmin`
- Create: `backend/src/routes/users.js` — CRUD endpoints
- Modify: `backend/src/app.js` — daftarkan route `/api/users`

**Frontend:**
- Modify: `frontend/src/components/layout/Sidebar.tsx` — tambah flag `devOrSuperAdminOnly`, tambah menu Pengguna
- Create: `frontend/src/app/dashboard/pengguna/page.tsx` — halaman manajemen pengguna

---

### Task 1: Update User Model + DB Migration

**Files:**
- Modify: `backend/src/models/User.js`

**DB Migration SQL (jalankan manual di phpMyAdmin / MySQL CLI):**

```sql
ALTER TABLE users
  ADD COLUMN nama_lengkap VARCHAR(100) NULL AFTER username,
  MODIFY COLUMN role ENUM('DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA') NOT NULL DEFAULT 'PENGGUNA';
```

- [ ] **Step 1: Jalankan SQL migration**

Jalankan SQL di atas di database. Verifikasi dengan `DESCRIBE users;` — pastikan kolom `nama_lengkap` ada dan ENUM role sudah bertambah.

- [ ] **Step 2: Update `backend/src/models/User.js`**

```js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  nama_lengkap: { type: DataTypes.STRING(100), allowNull: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA'),
    allowNull: false,
    defaultValue: 'PENGGUNA',
  },
  active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = User;
```

- [ ] **Step 3: Restart backend dan verifikasi**

Restart backend server. Pastikan tidak ada error Sequelize saat startup.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/User.js
git commit -m "feat: add nama_lengkap field and expand role enum (SUPER_ADMIN, PENGGUNA)"
```

---

### Task 2: Update Auth Middleware

**Files:**
- Modify: `backend/src/middleware/auth.js`

- [ ] **Step 1: Tambah `requireDevOrSuperAdmin` ke `auth.js`**

Tambahkan fungsi baru setelah `requireDev`:

```js
const requireDevOrSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'DEV' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya DEV atau SUPER_ADMIN yang diizinkan.' });
  }
  next();
};
```

Update exports di baris terakhir:

```js
module.exports = { authenticate, requireDev, requireDevOrSuperAdmin };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/auth.js
git commit -m "feat: add requireDevOrSuperAdmin middleware"
```

---

### Task 3: Buat Route `/api/users`

**Files:**
- Create: `backend/src/routes/users.js`
- Modify: `backend/src/app.js`

**Konteks penting:**
- DEV bisa lihat/kelola semua role: DEV, SUPER_ADMIN, ADMIN, PENGGUNA
- SUPER_ADMIN hanya bisa lihat/kelola role ADMIN dan PENGGUNA (tidak tahu DEV ada)
- SUPER_ADMIN tidak bisa melihat, mengedit, atau menghapus akun role DEV
- Siapapun tidak bisa menghapus atau menonaktifkan akun dirinya sendiri
- `logAction` helper ada di `require('../middleware/logger')`
- `bcrypt` untuk hash password: `const bcrypt = require('bcryptjs')`

- [ ] **Step 1: Buat `backend/src/routes/users.js`**

```js
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate, requireDevOrSuperAdmin } = require('../middleware/auth');
const { logAction } = require('../middleware/logger');

const router = express.Router();

// Roles yang bisa dikelola berdasarkan role caller
const getAllowedRoles = (callerRole) => {
  if (callerRole === 'DEV') return ['DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA'];
  return ['ADMIN', 'PENGGUNA'];
};

// GET /api/users - list semua user sesuai hak akses
router.get('/', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    const allowedRoles = getAllowedRoles(req.user.role);
    const users = await User.findAll({
      where: { role: allowedRoles },
      attributes: ['id', 'username', 'nama_lengkap', 'email', 'role', 'active', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/users - buat user baru
router.post('/', authenticate, requireDevOrSuperAdmin, [
  body('username').notEmpty().isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('role').notEmpty().withMessage('Role wajib diisi'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, nama_lengkap, email, password, role } = req.body;
    const allowedRoles = getAllowedRoles(req.user.role);

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Role tidak diizinkan' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, nama_lengkap: nama_lengkap || null, email, password: hashed, role });

    await logAction(req.user.id, 'CREATE_USER', `Buat user: ${username} (${role})`, req.ip);

    return res.status(201).json({
      id: user.id, username, nama_lengkap: user.nama_lengkap, email, role,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Username atau email sudah digunakan' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id - edit user (nama_lengkap, email, role, reset password opsional)
router.put('/:id', authenticate, requireDevOrSuperAdmin, [
  body('username').optional().isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('role').optional().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa mengedit user ini' });
    }

    const { username, nama_lengkap, email, password, role } = req.body;

    if (role && !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Role tidak diizinkan' });
    }

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (nama_lengkap !== undefined) updates.nama_lengkap = nama_lengkap;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (password) updates.password = await bcrypt.hash(password, 10);

    await target.update(updates);
    await logAction(req.user.id, 'UPDATE_USER', `Edit user: ${target.username}`, req.ip);

    return res.json({ message: 'User berhasil diupdate' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Username atau email sudah digunakan' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/users/:id/toggle-active - aktifkan/nonaktifkan user
router.patch('/:id/toggle-active', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menonaktifkan akun sendiri' });
    }

    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa mengubah status user ini' });
    }

    const newActive = target.active ? 0 : 1;
    await target.update({ active: newActive });
    await logAction(req.user.id, 'TOGGLE_USER_ACTIVE',
      `${newActive ? 'Aktifkan' : 'Nonaktifkan'} user: ${target.username}`, req.ip);

    return res.json({ message: `User berhasil ${newActive ? 'diaktifkan' : 'dinonaktifkan'}`, active: newActive });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/users/:id - hapus permanen
router.delete('/:id', authenticate, requireDevOrSuperAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
    }

    const allowedRoles = getAllowedRoles(req.user.role);
    const target = await User.findByPk(req.params.id);

    if (!target) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (!allowedRoles.includes(target.role)) {
      return res.status(403).json({ message: 'Tidak bisa menghapus user ini' });
    }

    const username = target.username;
    await target.destroy();
    await logAction(req.user.id, 'DELETE_USER', `Hapus user: ${username}`, req.ip);

    return res.json({ message: 'User berhasil dihapus' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Daftarkan route di `backend/src/app.js`**

Tambahkan setelah baris `app.use('/api/penjualan',`:

```js
app.use('/api/users', require('./routes/users'));
```

- [ ] **Step 3: Restart backend, verifikasi endpoint**

Test dengan curl atau Postman:
```
GET http://localhost:5000/api/users
Authorization: Bearer <token DEV>
```
Expected: array users (minimal 1 user DEV yang sedang login).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/users.js backend/src/app.js
git commit -m "feat: add /api/users CRUD route with role-based access control"
```

---

### Task 4: Frontend — Halaman Pengguna + Update Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/app/dashboard/pengguna/page.tsx`

**Konteks Sidebar:**
- File menggunakan MUI (`Box`, `List`, `ListItemButton`, `Collapse`, dll)
- `NavItem` interface punya `devOnly?: boolean`
- Perlu tambah flag `devOrSuperAdminOnly?: boolean`
- `user?.role` dari `useAuthStore`
- Icon dari `lucide-react`

**Konteks page:**
- Framework: Next.js App Router, `'use client'` directive wajib
- API calls via `import api from '@/lib/api.js'`
- Notifikasi via `import toast from 'react-hot-toast'`
- Styling: MUI components + Tailwind utility classes
- Role caller diambil dari `useAuthStore`: `const { user } = useAuthStore()`
- Kalau `user.role === 'DEV'` → tampilkan semua role di dropdown
- Kalau `user.role === 'SUPER_ADMIN'` → hanya ADMIN dan PENGGUNA di dropdown

**Badge warna role:**
- DEV: merah (`bg-red-100 text-red-700`)
- SUPER_ADMIN: ungu (`bg-purple-100 text-purple-700`)
- ADMIN: biru (`bg-blue-100 text-blue-700`)
- PENGGUNA: abu (`bg-gray-100 text-gray-600`)

- [ ] **Step 1: Update `NavItem` interface dan `NAV_ITEMS` di Sidebar**

Di `frontend/src/components/layout/Sidebar.tsx`:

1. Update interface `NavItem` — tambah field baru:
```ts
interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  children?: { label: string; href: string }[];
  devOnly?: boolean;
  devOrSuperAdminOnly?: boolean;
}
```

2. Tambah import icon `Users` dari lucide-react:
```ts
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList, ChevronDown, LogOut, Users,
} from 'lucide-react';
```

3. Tambah item Pengguna ke `NAV_ITEMS` setelah `Master Barang`:
```ts
{ label: 'Pengguna', href: '/dashboard/pengguna', icon: Users, devOrSuperAdminOnly: true },
```

4. Update filter di render loop — cari baris `if (item.devOnly && user?.role !== 'DEV') return null;` dan ganti dengan:
```ts
if (item.devOnly && user?.role !== 'DEV') return null;
if (item.devOrSuperAdminOnly && user?.role !== 'DEV' && user?.role !== 'SUPER_ADMIN') return null;
```

- [ ] **Step 2: Buat `frontend/src/app/dashboard/pengguna/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api.js';
import toast from 'react-hot-toast';

interface UserRow {
  id: number;
  username: string;
  nama_lengkap: string | null;
  email: string;
  role: 'DEV' | 'SUPER_ADMIN' | 'ADMIN' | 'PENGGUNA';
  active: number;
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  DEV: 'bg-red-100 text-red-700',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  PENGGUNA: 'bg-gray-100 text-gray-600',
};

const emptyForm = { username: '', nama_lengkap: '', email: '', password: '', role: 'PENGGUNA' as UserRow['role'] };

export default function PenggunaPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowedRoles: UserRow['role'][] =
    me?.role === 'DEV'
      ? ['DEV', 'SUPER_ADMIN', 'ADMIN', 'PENGGUNA']
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola akun pengguna sistem</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          + Tambah Pengguna
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Username</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nama Lengkap</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Memuat...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Belum ada pengguna</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.nama_lengkap || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                    {u.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === me?.id}
                      className={`px-3 py-1 text-xs font-medium border rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${u.active ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                    >
                      {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      disabled={u.id === me?.id}
                      className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              {editTarget ? `Edit User: ${editTarget.username}` : 'Tambah Pengguna Baru'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Username <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Lengkap</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.nama_lengkap}
                  onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))}
                  placeholder="Nama lengkap (opsional)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Password {editTarget ? <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span> : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editTarget ? 'Isi untuk reset password' : 'Minimal 6 karakter'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRow['role'] }))}
                >
                  {allowedRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">Hapus Pengguna?</h2>
            <p className="text-sm text-gray-600 mb-5">
              Akun <strong>{deleteTarget.username}</strong> akan dihapus permanen dari database dan tidak bisa dipulihkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition"
              >
                {deleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors pada file baru. Pre-existing errors pada file lain boleh diabaikan.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/app/dashboard/pengguna/page.tsx
git commit -m "feat: add user management page and sidebar entry for DEV/SUPER_ADMIN"
```
