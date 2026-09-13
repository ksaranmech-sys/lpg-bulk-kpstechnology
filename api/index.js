require('dotenv').config({ path: 'backend/.env' });

const app = require('../backend/src/app');
const connectDB = require('../backend/src/config/db');

let connectionPromise;

async function handler(req, res) {
  if (req.url === '/health' || req.url === '/api/health') {
    return res.json({ status: 'ok', time: new Date().toISOString() });
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri && process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: 'Missing MongoDB connection string (MONGO_URI, MONGO_URL, or MONGODB_URI) in environment variables.',
    });
  }

  try {
    if (!connectionPromise) {
      connectionPromise = connectDB().catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
    }

    await connectionPromise;

    if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    return app(req, res);
  } catch (error) {
    console.error('[vercel] API initialization failed:', error.message);
    return res.status(503).json({ error: 'API temporarily unavailable: ' + error.message });
  }
}

module.exports = handler;
