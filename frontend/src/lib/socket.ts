import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (socket?.connected) return socket;

  const url = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  socket = io(url, {
    path: '/socket.io',
    auth: { token: token || getToken() },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
  });

  return socket;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
