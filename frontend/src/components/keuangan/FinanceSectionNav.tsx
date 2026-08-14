import Link from 'next/link';
import { BarChart3, Boxes, Landmark, ReceiptText, WalletCards } from 'lucide-react';

export type FinanceSection = 'ringkasan' | 'offline' | 'interior' | 'uangMuka' | 'display';

const sections = [
  { key: 'ringkasan', label: 'Ringkasan Keuangan', description: 'Kondisi setiap transaksi', href: '/dashboard/keuangan', icon: BarChart3 },
  { key: 'offline', label: 'Piutang Offline', description: 'Tagihan berbasis invoice Offline', href: '/dashboard/piutang-usaha?view=offline', icon: WalletCards },
  { key: 'interior', label: 'Piutang Interior', description: 'Tagihan invoice per pengiriman', href: '/dashboard/piutang-usaha?view=interior', icon: Landmark },
  { key: 'uangMuka', label: 'Uang Muka Interior', description: 'Pembayaran yang belum terpakai', href: '/dashboard/piutang-usaha?view=uangMuka', icon: ReceiptText },
  { key: 'display', label: 'Outstanding Display', description: 'Barang display dan tagihannya', href: '/dashboard/piutang-display', icon: Boxes },
] as const;

export default function FinanceSectionNav({ active }: { active: FinanceSection }) {
  return (
    <section className="rounded-2xl p-3" style={{ background: '#fff', border: '1px solid #e8edf5' }} aria-label="Navigasi laporan keuangan">
      <div className="px-1 pb-3">
        <div className="text-xs font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>Area Keuangan</div>
        <div className="text-xs mt-1" style={{ color: '#64748b' }}>Pilih laporan sesuai pertanyaan yang ingin dijawab.</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {sections.map(section => {
          const selected = section.key === active;
          const Icon = section.icon;
          return (
            <Link
              key={section.key}
              href={section.href}
              aria-current={selected ? 'page' : undefined}
              className="min-h-[72px] rounded-xl px-3 py-3 flex items-start gap-2.5 transition-colors"
              style={selected
                ? { background: '#fff1f1', color: '#b91c1c', border: '1px solid #fecaca' }
                : { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
            >
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <span className="block text-xs font-black leading-tight">{section.label}</span>
                <span className="block text-[11px] leading-snug mt-1" style={{ color: selected ? '#dc2626' : '#94a3b8' }}>{section.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
