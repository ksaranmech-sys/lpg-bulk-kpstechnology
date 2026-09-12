require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { removeExpiredClosedTrips } = require('./utils/tripRetention');

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    await connectDB();
    const removedTrips = await removeExpiredClosedTrips();
    if (removedTrips > 0) {
      console.log(`[retention] Removed ${removedTrips} closed trip(s) older than one year`);
    }
    app.listen(PORT, () => {
      console.log(`[server] KPS Fleet API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
})();
