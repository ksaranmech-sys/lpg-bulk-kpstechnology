const config = require('./config/env');
const app = require('./app');
const connectDB = require('./config/db');
const { removeExpiredClosedTrips } = require('./utils/tripRetention');
const { ensureSeed } = require('./utils/seed');
const { initSettings } = require('./utils/settings');

// Runs after every successful DB (re)connect.
async function onConnected() {
  await initSettings();
  if (config.autoSeed) await ensureSeed();
  const removedTrips = await removeExpiredClosedTrips();
  if (removedTrips > 0) {
    console.log(`[retention] Removed ${removedTrips} closed trip(s) older than one year`);
  }
}

(async () => {
  try {
    await connectDB({ onConnected });
    app.listen(config.port, () => {
      console.log(`[server] KPS Fleet API listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
})();
