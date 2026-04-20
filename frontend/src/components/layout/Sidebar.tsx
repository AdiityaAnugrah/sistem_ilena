'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  ChevronDown,
  LogOut,
  Users,
  Folder,
  Settings,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  children?: { label: string; href: string }[];
  devOnly?: boolean;
  devOrSuperAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Penjualan',
    icon: ShoppingCart,
    children: [
      { label: 'Semua Penjualan', href: '/dashboard/penjualan' },
      { label: 'Penjualan Offline', href: '/dashboard/penjualan/offline' },
      { label: 'Display', href: '/dashboard/display' },
      { label: 'Penjualan Interior', href: '/dashboard/penjualan/interior' },
    ],
  },
  { label: 'Master Barang', href: '/dashboard/master/barang', icon: Package },
  { label: 'Semua Surat', href: '/surat', icon: Folder },
  { label: 'Pengguna', href: '/dashboard/pengguna', icon: Users, devOrSuperAdminOnly: true },
  { label: 'Log Aktivitas', href: '/dashboard/log-activity', icon: ClipboardList, devOnly: true },
  { label: 'Pengaturan', href: '/dashboard/pengaturan', icon: Settings, devOnly: true },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [openMenus, setOpenMenus] = useState<string[]>(['Penjualan']);
  const [mounted, setMounted] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  };

  const isMenuActive = (item: NavItem) => {
    if (item.href) {
      return item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
    }
    return item.children?.some((c) => pathname.startsWith(c.href)) ?? false;
  };

  if (!mounted) return null;

  return (
    <>
      <div style={{
        width: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        color: 'rgba(255,255,255,0.7)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logoilena.svg" alt="ILENA" style={{ height: 24, width: 'auto' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)',
            padding: '0 8px', marginBottom: 10,
          }}>
            Navigasi Utama
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              if (item.devOnly && user?.role !== 'DEV') return null;
              if (item.devOrSuperAdminOnly && user?.role !== 'DEV' && user?.role !== 'SUPER_ADMIN') return null;

              const active = isMenuActive(item);
              const hasChildren = !!item.children;
              const isOpen = openMenus.includes(item.label);

              return (
                <div key={item.label}>
                  {hasChildren ? (
                    <button
                      onClick={() => toggleMenu(item.label)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        backgroundColor: active ? 'rgba(250,47,47,0.12)' : 'transparent',
                        color: active ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                        textAlign: 'left',
                      }}
                    >
                      <item.icon size={17} color={active ? '#fca5a5' : 'rgba(255,255,255,0.35)'} strokeWidth={1.75} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
                      <ChevronDown
                        size={13}
                        color="rgba(255,255,255,0.25)"
                        strokeWidth={2}
                        style={{
                          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href!}
                      onClick={onNavigate}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                        backgroundColor: active ? 'rgba(250,47,47,0.12)' : 'transparent',
                        color: active ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <item.icon size={17} color={active ? '#fca5a5' : 'rgba(255,255,255,0.35)'} strokeWidth={1.75} />
                      <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
                    </Link>
                  )}

                  {hasChildren && isOpen && (
                    <div style={{ marginLeft: 26, marginTop: 2, paddingLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {item.children?.map((child) => {
                        const childActive = pathname === child.href || pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            style={{
                              display: 'block', padding: '6px 8px', borderRadius: 6,
                              textDecoration: 'none', fontSize: 12.5,
                              fontWeight: childActive ? 600 : 400,
                              color: childActive ? '#fca5a5' : 'rgba(255,255,255,0.45)',
                            }}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link
            href="/dashboard/profil"
            onClick={onNavigate}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', marginBottom: 4, borderRadius: 8,
              textDecoration: 'none',
              backgroundColor: pathname === '/dashboard/profil' ? 'rgba(250,47,47,0.12)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (pathname !== '/dashboard/profil')
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              if (pathname !== '/dashboard/profil')
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #d41a1a, #b91414)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                {user?.role} · Edit Profil
              </div>
            </div>
          </Link>
          <button
            onClick={() => setLogoutConfirm(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Keluar Sistem</span>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {logoutConfirm && mounted && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 320, background: '#fff', borderRadius: 16, padding: 24,
            boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={18} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Keluar Sistem</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Sesi Anda akan diakhiri</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 20px' }}>
              Yakin ingin keluar? Anda perlu login kembali untuk mengakses sistem.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setLogoutConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
