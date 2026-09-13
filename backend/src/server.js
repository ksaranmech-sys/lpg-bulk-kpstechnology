const path = require('path');
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`[server] KPS Fleet API listening on port ${PORT}`);
    });
    ;
  } catch (err) {
    console.error('[server] Unexpected startup error:', err);
  }
})();
