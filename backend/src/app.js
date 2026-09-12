require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const tripRoutes = require('./routes/tripRoutes');
const metaRoutes = require('./routes/metaRoutes');
const leaveRoutes = require('./routes/leaveRoutes');

const app = express();
const uploadsPath = path.resolve(__dirname, '../', process.env.UPLOAD_DIR || 'uploads');
const frontendBuildPath = path.resolve(__dirname, '../../frontend/build');

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving uploaded photos cross-origin
app.use(cors()); // tighten to specific origins in production
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve locally-stored trip photos (dev only - use S3/CDN in production)
app.use('/uploads', express.static(uploadsPath));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// All routes are versioned under /api/v1 so the mobile app can pin to a
// version and the web app can move to v2 later without breaking the app.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/meta', requireAuth, metaRoutes);
app.use('/api/v1/leaves', leaveRoutes);

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
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
