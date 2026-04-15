const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/error');

const app = express();

// Connect to MongoDB
connectDB();

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, 'uploads/covers');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend if exists
const frontendPath = path.join(__dirname, '../frontend/public');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Library API is running', timestamp: new Date() });
});

// Serve frontend for SPA (catch-all)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  const indexPath = path.join(__dirname, '../frontend/public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not found. Please set up the frontend or use the API directly.');
  }
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(` Library Management System API`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
