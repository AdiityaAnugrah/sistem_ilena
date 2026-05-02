'use client';
import { useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import GlobalSearch from '@/components/GlobalSearch';
import { Menu, X } from 'lucide-react';
import useAuthStore from '@/store/authStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s: { user: { role?: string } | null }) => s.user);
  const isTestMode = user?.role === 'TEST';

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden" style={{ background: '#f8fafc' }}>
        
        {/* Mobile Header (z-40 so it stays above backdrop [z-30], but sidebar left flies over it at z-50) */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-[60px] bg-white border-b z-40 flex items-center px-4 justify-between" style={{ borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}>
              <span className="text-white font-bold text-[10px] tracking-tight">IL</span>
            </div>
            <div className="font-semibold text-[15px] text-slate-800 tracking-tight">ILENA</div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Sidebar overlay for mobile (z-30 overlays main content) */}
        {isSidebarOpen && (
           <div 
             className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden transition-opacity" 
             onClick={() => setSidebarOpen(false)} 
           />
        )}

        {/* Sidebar Wrapper (z-50 highest priority for sliding drawer) */}
        <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
           <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full lg:ml-[260px] pt-[60px] lg:pt-0 overflow-y-auto">
          {isTestMode && (
            <div style={{
              background: 'linear-gradient(90deg, #d97706, #f59e0b)',
              color: '#fff',
              textAlign: 'center',
              padding: '6px 16px',
              fontSize: '12.5px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              boxShadow: '0 1px 4px rgba(217,119,6,0.25)',
            }}>
              ⚠ MODE TESTING — Data tidak akan mempengaruhi data produksi
            </div>
          )}
          <div className="p-4 md:p-6 lg:p-7 animate-fade-in max-w-[100vw] lg:max-w-none">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
