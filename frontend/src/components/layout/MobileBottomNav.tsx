'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  LayoutDashboard,
  Menu,
  ShoppingCart,
  Wallet,
} from 'lucide-react';

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Penjualan', href: '/dashboard/penjualan', icon: ShoppingCart },
  { label: 'Surat', href: '/dashboard/surat', icon: FileText },
  { label: 'Keuangan', href: '/dashboard/keuangan', icon: Wallet },
];

export default function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="lg:hidden fixed left-0 right-0 bottom-0 z-40 bg-white"
      style={{
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -6px 24px rgba(15,23,42,0.08)',
        padding: '7px 8px calc(7px + env(safe-area-inset-bottom))',
      }}
      aria-label="Navigasi utama mobile"
    >
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl transition-colors"
              style={{
                color: active ? '#FA2F2F' : '#64748b',
                background: active ? '#fff1f1' : 'transparent',
                fontWeight: active ? 800 : 700,
              }}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl transition-colors"
          style={{
            color: '#64748b',
            background: 'transparent',
            fontWeight: 700,
          }}
          aria-label="Buka menu lainnya"
        >
          <Menu size={21} strokeWidth={2} />
          <span className="text-[11px] leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
