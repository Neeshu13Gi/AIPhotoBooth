const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  mongodbUri:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/AIPhotoBoothUser',

  // Video Provider Config
  videoProvider: (process.env.VIDEO_PROVIDER || 'mock').toLowerCase().trim(),
  videoModel: process.env.VIDEO_MODEL || 'Wan-AI/Wan2.2-I2V-A14B',

  // Provider Keys
  falKey: process.env.FAL_KEY || '',
  hfToken: process.env.HF_TOKEN || '',
  replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
  runwayApiSecret: process.env.RUNWAY_API_SECRET || '',
  klingAccessKey: process.env.KLING_ACCESS_KEY || '',
  klingSecretKey: process.env.KLING_SECRET_KEY || '',
  lumaApiKey: process.env.LUMA_API_KEY || '',

  // Video settings
  videoDuration: parseInt(process.env.VIDEO_DURATION_SECONDS, 10) || 5,
  videoAspectRatio: process.env.VIDEO_ASPECT_RATIO || '9:16',
  defaultMotionPrompt: process.env.DEFAULT_MOTION_PROMPT || 'gentle warm smile, natural subtle head movement, glowing photorealistic lighting, cinematic portrait',

  // Storage
  storageType: process.env.STORAGE_TYPE || 'local',
  uploadDir: path.resolve(__dirname, '../../uploads'),
  inputsDir: path.resolve(__dirname, '../../uploads/inputs'),
  framesDir: path.resolve(__dirname, '../../uploads/frames'),
  outputsDir: path.resolve(__dirname, '../../uploads/outputs'),
  qrCodesDir: path.resolve(__dirname, '../../uploads/qrcodes'),
};

module.exports = config;
