'use client';
// Display baru - sama seperti penjualan offline tapi tipe=DISPLAY, langsung redirect ke form offline dengan preset
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to penjualan offline baru with display preset
// We handle this by using the same form with tipe=DISPLAY
export default function DisplayBaru() {
  const router = useRouter();
  // For simplicity, we reuse the offline form with DISPLAY pre-selected
  // The form handles tipe selection
  useEffect(() => {
    router.replace('/dashboard/penjualan/offline/baru?tipe=DISPLAY');
  }, [router]);
  return null;
}
