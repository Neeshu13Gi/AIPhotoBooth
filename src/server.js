const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/env');

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB initially. Server will start but database operations may fail until MongoDB is accessible.');
  }

  const server = app.listen(config.port, () => {
    console.log('====================================================');
    console.log(`🚀 Frame AI PhotoBooth Backend running on port ${config.port}`);
    console.log(`🌐 Base URL: ${config.appBaseUrl}`);
    console.log(`🤖 Active Video Provider: [${config.videoProvider.toUpperCase()}]`);
    console.log(`📦 Configured Model: [${config.videoModel}]`);
    console.log(`🗄️  MongoDB URI: ${config.mongodbUri}`);
    console.log('====================================================');
  });

  // Handle process termination gracefully
  const shutdown = () => {
    console.log('Shutting down server gracefully...');
    server.close(() => {
      console.log('Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
