'use client';
import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export function useListSync(room: string, onUpdate: () => void) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!room) return;
    const socket = getSocket();
    const handler = () => cbRef.current();
    socket.emit('room:join', { room });
    socket.on('data:updated', handler);
    return () => {
      socket.emit('room:leave', { room });
      socket.off('data:updated', handler);
    };
  }, [room]);
}
