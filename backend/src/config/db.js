const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./env');

// Fallback DNS servers to resolve MongoDB SRV records if local ISP/router DNS fails
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS servers cannot be set
}

const RETRY_MS = 5000;
const connectOptions = {
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 3000),
  connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 5000),
};

let isConnecting = false;
let retryInterval = null;
let memoryServer = null;
let onConnectedHook = null;

function candidateUris() {
  const rawUri = config.mongoUri || 'mongodb://127.0.0.1:27017/kps-fleet';
  const uris = [rawUri];
  if (rawUri.includes('localhost')) uris.push(rawUri.replace('localhost', '127.0.0.1'));
  else if (rawUri.includes('127.0.0.1')) uris.push(rawUri.replace('127.0.0.1', 'localhost'));
  return uris;
}

// Dev-only throwaway database. Loaded lazily so the package is never touched in production.
async function memoryMongoUri() {
  if (memoryServer) return memoryServer.getUri();
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'kps-fleet' } });
  return memoryServer.getUri();
}

async function tryConnect(uri, label) {
  await mongoose.connect(uri, connectOptions);
  console.log(`[db] ${label} connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
  if (onConnectedHook) {
    try {
      await onConnectedHook();
    } catch (hookErr) {
      console.error('[db] Error during post-connection setup:', hookErr.message);
    }
  }
}

async function attemptConnect() {
  if (mongoose.connection.readyState === 1 || isConnecting) return true;
  isConnecting = true;
  mongoose.set('strictQuery', true);

  try {
    for (const uri of candidateUris()) {
      try {
        await tryConnect(uri, 'MongoDB');
        return true;
      } catch (err) {
        // try the next candidate
      }
    }

    // The in-memory fallback must never activate in production: data written to it is lost on
    // the next restart.
    const useMemory = process.env.USE_MEMORY_MONGO === 'true';
    if (useMemory && config.isProduction) {
      console.error('[db] USE_MEMORY_MONGO=true ignored because NODE_ENV=production.');
    } else if (useMemory) {
      try {
        await tryConnect(await memoryMongoUri(), 'MongoMemoryServer');
        return true;
      } catch (memErr) {
        console.error('[db] MongoMemoryServer fallback failed:', memErr.message);
      }
    }
    return false;
  } finally {
    isConnecting = false;
  }
}

function scheduleRetry() {
  if (retryInterval) return;
  retryInterval = setInterval(attemptConnect, RETRY_MS);
}

// `onConnected` runs after every successful (re)connect - used for seeding/housekeeping.
async function connectDB({ onConnected } = {}) {
  onConnectedHook = onConnected || null;
  const success = await attemptConnect();

  if (!success) {
    console.warn('\n====================================================================');
    console.warn('[db] WARNING: Cannot connect to MongoDB!');
    console.warn(`[db] URI attempted: ${config.mongoUri || 'mongodb://127.0.0.1:27017/kps-fleet'}`);
    console.warn('1. Ensure MongoDB is running locally (mongod / MongoDB Compass), OR');
    console.warn('2. Set MONGO_URI in backend/.env to your MongoDB Atlas connection string.');
    console.warn(`[db] Server is running. Retrying every ${RETRY_MS / 1000} seconds...`);
    console.warn('====================================================================\n');
    scheduleRetry();
  }

  mongoose.connection.on('error', (err) => console.error('[db] Connection error:', err.message));
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected. Attempting to reconnect...');
    scheduleRetry();
  });

  return success;
}

process.on('exit', () => {
  if (memoryServer) memoryServer.stop();
});

module.exports = connectDB;
