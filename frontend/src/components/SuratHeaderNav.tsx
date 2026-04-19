'use client';
import { useEffect, useState } from 'react';
import useAuthStore from '@/store/authStore';

export default function SuratHeaderNav() {
  const { isAuthenticated, initFromStorage } = useAuthStore() as any;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initFromStorage();
    setReady(true);
  }, []);

  if (!ready) return null;

  const btnStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none', padding: '7px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
    marginLeft: 12, whiteSpace: 'nowrap',
  };

  if (isAuthenticated) {
    return (
      <a href="/dashboard" style={btnStyle}>
        Dashboard →
      </a>
    );
  }

  return (
    <a href="/login" style={btnStyle}>
      Masuk
    </a>
  );
}
