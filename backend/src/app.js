const config = require('./config/env');
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { requireAuth } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const tripRoutes = require('./routes/tripRoutes');
const metaRoutes = require('./routes/metaRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const vehicleExpenseRoutes = require('./routes/vehicleExpenseRoutes');

const app = express();
const uploadsPath = path.resolve(__dirname, '../', config.storage.uploadDir);
const frontendBuildPath = path.resolve(__dirname, '../../build');

// Website requests arrive via two proxies (Vercel rewrite -> Render load balancer); mobile app
// requests via one. Trusting two hops resolves req.ip to the real client in both cases, so the
// login rate limiter doesn't treat every website user as a single Vercel address.
app.set('trust proxy', 2);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // photos are embedded by other origins
app.use(cors({
  origin(origin, callback) {
    // No Origin header = native app, curl, or same-origin proxy request - always allowed.
    if (!origin || !config.allowedOrigins.length || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('Origin not allowed'), { status: 403 }));
  },
}));
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve locally-stored trip photos (dev only - STORAGE_DRIVER=cloudinary in production)
app.use('/uploads', express.static(uploadsPath));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// All routes are versioned under /api/v1 so the mobile app can pin to a
// version and the web app can move to v2 later without breaking the app.
app.use('/api/', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/meta', requireAuth, metaRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/vehicle-expenses', vehicleExpenseRoutes);

// Serve the React application from the same origin as the API.
app.use(express.static(frontendBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/uploads/')) {
    return next();
  }
  return res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler
app.use((err, req, res, next) => {
  // Mongo duplicate key error (e.g. username already taken) - surface a friendly message
  // instead of the raw driver error text.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'value';
    const value = err.keyValue ? err.keyValue[field] : undefined;
    const label = field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(409).json({
      error: value ? `${label} "${value}" is already in use` : `${label} is already in use`,
    });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be smaller than 10MB' : err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path || 'id'}` });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  // Never leak internal error text (stack traces, DB messages) to clients on unexpected failures.
  const message = status >= 500 && config.isProduction ? 'Internal server error' : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

module.exports = app;
