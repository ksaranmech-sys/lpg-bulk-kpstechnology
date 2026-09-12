require('dotenv').config({ path: 'backend/.env' });

const app = require('../backend/src/app');
const connectDB = require('../backend/src/config/db');

let connectionPromise;

async function handler(req, res) {
  if (!connectionPromise) {
    connectionPromise = connectDB().catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
  return app(req, res);
}

module.exports = handler;
