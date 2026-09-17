'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useListSync } from '@/hooks/useListSync';

export type DashboardBadges = {
  offlineActive: number;
  interiorActive: number;
  onlineWebsite: number;
  onlineWebsiteTodo: number;
  onlineWaitingPayment: number;
  penjualanTotal: number;
};

const emptyBadges: DashboardBadges = {
  offlineActive: 0,
  interiorActive: 0,
  onlineWebsite: 0,
  onlineWebsiteTodo: 0,
  onlineWaitingPayment: 0,
  penjualanTotal: 0,
};

export function useDashboardBadges() {
  const [badges, setBadges] = useState<DashboardBadges>(emptyBadges);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/sales-followup');
      const summary = res.data?.summary || {};
      const next = {
        offlineActive: Number(summary.offlineActive || 0),
        interiorActive: Number(summary.interiorActive || 0),
        onlineWebsite: Number(summary.onlineWebsite || 0),
        onlineWebsiteTodo: Number(summary.onlineWebsiteTodo || summary.onlineWebsite || 0),
        onlineWaitingPayment: Number(summary.onlineWaitingPayment || 0),
      };
      setBadges({
        ...next,
        penjualanTotal: next.offlineActive + next.interiorActive + next.onlineWebsiteTodo,
      });
    } catch {
      setBadges(emptyBadges);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  useListSync('penjualan-online-list', fetchBadges);
  useListSync('penjualan-offline-list', fetchBadges);
  useListSync('penjualan-interior-list', fetchBadges);

  return useMemo(() => ({ badges, loading, refresh: fetchBadges }), [badges, loading, fetchBadges]);
}
