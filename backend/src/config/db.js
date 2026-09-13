const mongoose = require('mongoose');
const dns = require('dns');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Fallback DNS servers to resolve MongoDB SRV records if local ISP/router DNS fails
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS servers cannot be set
}

let isConnecting = false;
let retryInterval = null;
let memoryServer = null;

async function startMemoryMongo() {
  if (memoryServer) return memoryServer.getUri();

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'kps-fleet',
    },
  });

  return memoryServer.getUri();
}

async function attemptConnect() {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return true;
  }

  isConnecting = true;
  const rawUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kps-fleet';

  const urisToTry = [rawUri];
  if (rawUri.includes('localhost')) {
    urisToTry.push(rawUri.replace('localhost', '127.0.0.1'));
  } else if (rawUri.includes('127.0.0.1')) {
    urisToTry.push(rawUri.replace('127.0.0.1', 'localhost'));
  }

  mongoose.set('strictQuery', true);

  for (const uri of urisToTry) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 3000),
        connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 5000),
      });
      console.log(`[db] MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);

      if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
      }
      isConnecting = false;

      try {
        const { removeExpiredClosedTrips } = require('../utils/tripRetention');
        const removedTrips = await removeExpiredClosedTrips();
        if (removedTrips > 0) {
          console.log(`[retention] Removed ${removedTrips} closed trip(s) older than one year`);
        }
      } catch (retentionErr) {
        console.error('[retention] Error during initial trip cleanup:', retentionErr.message);
      }

      return true;
    } catch (err) {
      // continue to fallback below
    }
  }

  const shouldUseMemoryFallback = !process.env.MONGO_URI && process.env.NODE_ENV !== 'production';
  if (shouldUseMemoryFallback) {
    try {
      const fallbackUri = await startMemoryMongo();
      await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 3000),
        connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 5000),
      });
      console.log(`[db] MongoMemoryServer connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);

      if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
      }
      isConnecting = false;
      return true;
    } catch (memErr) {
      console.error('[db] MongoMemoryServer fallback failed:', memErr.message);
    }
  } else if (process.env.NODE_ENV === 'production' && !process.env.MONGO_URI) {
    console.warn('[db] Production deployment requires MONGO_URI. Refusing to fall back to MongoMemoryServer.');
  }

  isConnecting = false;
  return false;
}

async function connectDB() {
  const success = await attemptConnect();

  if (!success) {
    console.warn('\n====================================================================');
    console.warn('[db] WARNING: Cannot connect to MongoDB!');
    console.warn(`[db] URI attempted: ${process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kps-fleet'}`);
    console.warn('\nTo resolve this issue:');
    console.warn('1. Ensure MongoDB service is running locally (e.g. open MongoDB Compass, run mongod, or start MongoDB service)');
    console.warn('2. OR update MONGO_URI in backend/.env with your MongoDB Atlas or remote connection string');
    console.warn('\n[db] Server is running. Retrying MongoDB connection every 5 seconds...');
    console.warn('====================================================================\n');

    if (!retryInterval) {
      retryInterval = setInterval(async () => {
        await attemptConnect();
      }, 5000);
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected. Attempting to reconnect...');
    if (!retryInterval) {
      retryInterval = setInterval(async () => {
        await attemptConnect();
      }, 5000);
    }
  });

  return success;
}

process.on('exit', async () => {
  if (memoryServer) {
    await memoryServer.stop();
  }
});

module.exports = connectDB;
