function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `API route ${req.method} ${req.originalUrl} not found`,
  });
}

function errorHandler(err, req, res, next) {
  console.error('Server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = { notFoundHandler, errorHandler };
