'use client';
import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';

interface PresenceUser {
  socketId: string;
  userId: number;
  nama: string;
}

interface UseRoomPresenceResult {
  others: PresenceUser[];   // users lain di room yang sama (tidak termasuk diri sendiri)
  dataUpdated: boolean;     // true jika ada update dari user lain
  clearDataUpdated: () => void;
}

export function useRoomPresence(room: string, myUserId?: number): UseRoomPresenceResult {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const [dataUpdated, setDataUpdated] = useState(false);
  const roomRef = useRef(room);

  useEffect(() => {
    if (!room) return;
    roomRef.current = room;

    const socket = getSocket();

    const handlePresence = (users: PresenceUser[]) => {
      // Hilangkan diri sendiri dari daftar
      const otherUsers = users.filter(u => u.userId !== myUserId);
      setOthers(otherUsers);
    };

    const handleDataUpdated = (payload: { updatedBy?: number }) => {
      // Hanya tampilkan notifikasi jika yang update bukan diri sendiri
      if (payload.updatedBy !== myUserId) {
        setDataUpdated(true);
      }
    };

    socket.emit('room:join', { room });
    socket.on('room:presence', handlePresence);
    socket.on('data:updated', handleDataUpdated);

    return () => {
      socket.emit('room:leave', { room: roomRef.current });
      socket.off('room:presence', handlePresence);
      socket.off('data:updated', handleDataUpdated);
    };
  }, [room, myUserId]);

  return {
    others,
    dataUpdated,
    clearDataUpdated: () => setDataUpdated(false),
  };
}
