const express = require('express');
const router = express.Router();
const { ROLES } = require('../config/constants');
const { requireAuth, requireRole } = require('../middleware/auth');
const dieselPrices = require('../utils/dieselPrices');

// Super admin only: the "Average Diesel Price" per state/month table shown on the dashboard.
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/', (req, res) => {
  res.json({ dieselPriceTable: dieselPrices.getTable() });
});

// Body: { cells: { [state]: { [month]: number | null } } } - only the edited cells.
router.put('/', async (req, res) => {
  try {
    const dieselPriceTable = await dieselPrices.saveManualEdits(req.body?.cells);
    res.json({ dieselPriceTable });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update diesel price table' });
  }
});

// Re-pull from fuelpricetoday.in / v3cars.com now instead of waiting for the daily job.
router.post('/sync', async (req, res) => {
  const dieselPriceTable = await dieselPrices.syncDieselPrices();
  res.json({ dieselPriceTable });
});

module.exports = router;
