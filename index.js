require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
// const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const hpp = require('hpp');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { setupSocket } = require('./utils/socket');
const expireInvites = require('./jobs/expireInvites');


const app = express();
const server = createServer(app);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  autoIndex: process.env.NODE_ENV !== 'production'
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

expireInvites.start();


// Security middleware 
app.use(helmet());

const allowedOrigins = [
  process.env.CLIENT_URL, 
  'http://localhost:5173', // Your Vite dev server
  'http://127.0.0.1:5173'
];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
// app.use(mongoSanitize());
// app.use(xss());
app.use(hpp()); 
app.use(compression());


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + (req.headers['user-agent'] || '')
});
app.use('/api', limiter);

// Initialize Socket.io
setupSocket(server);

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/submissions', require('./routes/submissions'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/invite', require('./routes/invites'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Resource not found' 
  }); 
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error' 
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Docs available at http://localhost:${PORT}/api-docs`);
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});