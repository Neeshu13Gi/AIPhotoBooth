const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/env');
const frameRoutes = require('./routes/frameRoutes');
const jobRoutes = require('./routes/jobRoutes');
const userRoutes = require('./routes/userRoutes');
const shareRoutes = require('./routes/shareRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded static assets (inputs, frames, outputs, qrcodes)
app.use('/uploads', express.static(config.uploadDir));

// Serve interactive PhotoBooth Frontend application
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/frames', frameRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/users', userRoutes);
app.use('/share', shareRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Frame AI PhotoBooth Backend',
    timestamp: new Date(),
    provider: config.videoProvider,
    model: config.videoModel,
  });
});

// Root welcome
app.get('/', (req, res) => {
  res.json({
    name: 'Frame AI PhotoBooth API',
    status: 'running',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      frames: '/api/frames',
      generate: 'POST /api/jobs/generate',
      status: 'GET /api/jobs/status/:jobId',
      result: 'GET /api/jobs/result/:jobId',
      providerInfo: 'GET /api/jobs/provider-info',
    },
  });
});

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
