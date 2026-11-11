const notFoundMiddleware = (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) console.error("API error:", err);
  res.status(status).json({
    success: false,
    error: status >= 500 ? "Internal server error" : (err.message || "Request failed")
  });
};

module.exports = { notFoundMiddleware, errorMiddleware };
