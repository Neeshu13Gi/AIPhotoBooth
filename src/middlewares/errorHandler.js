const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]:', err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;
