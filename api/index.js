require('dotenv').config({ path: 'backend/.env' });

const app = require('../backend/src/app');
const connectDB = require('../backend/src/config/db');

let connectionPromise;
const requiredEnvironment = ['MONGO_URI', 'JWT_SECRET'];

async function handler(req, res) {
  const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

  if (missingEnvironment.length) {
    return res.status(500).json({
      error: `Missing Vercel environment variable(s): ${missingEnvironment.join(', ')}`,
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
    return app(req, res);
  } catch (error) {
    console.error('[vercel] API initialization failed:', error.message);
    return res.status(503).json({ error: 'API temporarily unavailable' });
  }
}

module.exports = handler;
