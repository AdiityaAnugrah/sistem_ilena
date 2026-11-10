'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export function useFinanceRefresh(refresh: () => void) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    let timer: ReturnType<typeof setTimeout>;
    const subscribe = () => socket.emit('room:subscribe', { room: 'finance-updates' });
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 150);
    };
    subscribe();
    socket.on('connect', subscribe);
    socket.on('data:updated', update);
    window.addEventListener('focus', update);
    return () => {
      clearTimeout(timer);
      socket.emit('room:unsubscribe', { room: 'finance-updates' });
      socket.off('connect', subscribe);
      socket.off('data:updated', update);
      window.removeEventListener('focus', update);
    };
  }, []);
}
