const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

const presenceMap = new Map();

function init(server, allowedOrigins) {
  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: '/socket.io',
  });

  // Auth middleware — verifikasi JWT sebelum terkoneksi
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id, nama: decoded.nama_lengkap || decoded.username || 'Pengguna' };
      next();
    } catch {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, nama } = socket.user;

    // User bergabung ke room (misal: "penjualan-offline:42")
    socket.on('room:join', ({ room }) => {
      if (!room) return;

      // Tinggalkan room lama jika ada
      const prev = presenceMap.get(socket.id);
      if (prev?.room && prev.room !== room) {
        socket.leave(prev.room);
        broadcastPresence(prev.room);
      }

      socket.join(room);
      presenceMap.set(socket.id, { userId, nama, room });
      broadcastPresence(room);
    });

    // User meninggalkan room
    socket.on('room:leave', ({ room }) => {
      socket.leave(room);
      presenceMap.delete(socket.id);
      broadcastPresence(room);
    });

    // Disconnect otomatis
    socket.on('disconnect', () => {
      const entry = presenceMap.get(socket.id);
      presenceMap.delete(socket.id);
      if (entry?.room) broadcastPresence(entry.room);
    });
  });

  return io;
}

// Kirim daftar user yang sedang ada di room ke semua anggota room
function broadcastPresence(room) {
  if (!io) return;
  const users = [];
  for (const [sid, entry] of presenceMap.entries()) {
    if (entry.room === room) users.push({ socketId: sid, userId: entry.userId, nama: entry.nama });
  }
  io.to(room).emit('room:presence', users);
}

// Emit event perubahan data ke semua anggota room
function emitDataUpdated(room, payload = {}) {
  if (!io) return;
  io.to(room).emit('data:updated', { room, ...payload });
}

function getIO() { return io; }

module.exports = { init, getIO, emitDataUpdated };
