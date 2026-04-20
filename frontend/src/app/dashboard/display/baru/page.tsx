'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DisplayBaru() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/penjualan/offline/baru?tipe=DISPLAY');
  }, [router]);
  return null;
}
