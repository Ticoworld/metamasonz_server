const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const setupSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.SOCKET_ORIGIN || process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                   socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Join role-specific room
    socket.join(socket.user.role);
    
    // Handle admin notifications
    socket.on('notify-admins', (message) => {
      if (socket.user.role === 'admin') {
        io.to('admin').emit('admin-notification', {
          from: socket.user.email,
          message
        });
      }
    });

    // Handle submission updates
    socket.on('submission-update', (data) => {
      if (socket.user.role === 'admin') {
        io.emit('submission-status-changed', data);
      }
    });

    // Ping/pong for connection monitoring
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') {
        cb('pong');
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  setupSocket,
  getIO
};