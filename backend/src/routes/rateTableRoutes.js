const express = require('express');
const router = express.Router();
const { ROLES } = require('../config/constants');
const { requireAuth, requireRole } = require('../middleware/auth');
const rateTables = require('../utils/rateTables');

// Super admin only: the "Rate/KM/Ton" tables (one per state) calculated from average diesel prices.
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/', (req, res) => {
  res.json({ rateTables: rateTables.listRateTables() });
});

router.get('/:tableId', (req, res) => {
  const rateTable = rateTables.getRateTable(req.params.tableId);
  if (!rateTable) return res.status(404).json({ error: 'Rate table not found' });
  res.json({ rateTable });
});

// Body: { bases: { [rowKey]: number } } - only the edited Base values.
router.put('/:tableId/bases', async (req, res) => {
  if (!rateTables.findConfig(req.params.tableId)) return res.status(404).json({ error: 'Rate table not found' });
  try {
    res.json({ rateTable: await rateTables.saveRateTableBases(req.params.tableId, req.body?.bases) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update rate table' });
  }
});

module.exports = router;
