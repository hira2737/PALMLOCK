/**
 * PALMLOCK — Socket.IO Server & Real-time Incident Event Handler
 * Provides authenticated WebSockets with room partitioning for admins and users.
 */

const jwt = require('jsonwebtoken');

let ioInstance = null;

function initSocketIO(server, options = {}) {
  const { Server } = require('socket.io');

  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGINS
        ? process.env.CLIENT_ORIGINS.split(',').map((s) => s.trim())
        : ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    ...options
  });

  // Authentication Middleware for incoming socket connections
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!token) {
        // Allow unauthenticated guest connections in read-only / public room if needed,
        // but mark socket as unauthenticated
        socket.user = null;
        return next();
      }

      const secret = process.env.JWT_SECRET || 'palmlock_super_secret_jwt_key_2026';
      const decoded = jwt.verify(token, secret);
      socket.user = decoded;
      return next();
    } catch (err) {
      // Invalid token — proceed as unauthenticated rather than abruptly disconnecting
      socket.user = null;
      return next();
    }
  });

  io.on('connection', (socket) => {
    const userRole = socket.user?.role || 'guest';
    const userId = socket.user?.id || socket.user?._id;

    console.log(`[SOCKET] Client connected: ${socket.id} (Role: ${userRole}, User: ${userId || 'anonymous'})`);

    // Automatically join role-specific rooms
    if (userRole === 'admin') {
      socket.join('room:admins');
      console.log(`[SOCKET] ${socket.id} joined room:admins`);
    } else if (userId) {
      socket.join(`room:user:${userId}`);
      console.log(`[SOCKET] ${socket.id} joined room:user:${userId}`);
    }

    // Client can explicitly request to join rooms (with validation)
    socket.on('join', (roomName) => {
      if (roomName === 'room:admins') {
        if (socket.user && socket.user.role === 'admin') {
          socket.join('room:admins');
        } else {
          socket.emit('error', { message: 'Unauthorized room access' });
        }
      } else if (roomName === 'room:user' && userId) {
        socket.join(`room:user:${userId}`);
      }
    });

    // Handle siren broadcast test from admin dashboard
    socket.on('admin:siren', (payload) => {
      if (socket.user?.role === 'admin') {
        console.log('[SOCKET] Admin triggered siren broadcast:', payload);
        io.to('room:admins').emit('siren:trigger', payload);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

function broadcastToAdmins(event, data) {
  if (ioInstance) {
    ioInstance.to('room:admins').emit(event, data);
  }
}

function sendToUser(userId, event, data) {
  if (ioInstance) {
    ioInstance.to(`room:user:${userId}`).emit(event, data);
  }
}

function broadcastAll(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

module.exports = {
  initSocketIO,
  getIO,
  broadcastToAdmins,
  sendToUser,
  broadcastAll
};
