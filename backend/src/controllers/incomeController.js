// Monthly Income endpoint: a customer's trips for one month with TDS / Diesel / Amount split,
// grouped by corporation. Admin-only (super_admin or the customer's own admin).
const metaRoutes = require('../routes/metaRoutes');
const {
  validateIncomeMonth,
  defaultIncomeMonth,
  buildMonthlyIncome,
  loadTripsForMonth,
} = require('../utils/monthlyIncome');

// GET /api/v1/customers/:customerId/income?month=YYYY-MM
async function getCustomerMonthlyIncome(req, res) {
  const { customerId } = req.params;
  const month = req.query.month || defaultIncomeMonth();
  const monthError = validateIncomeMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });

  const trips = await loadTripsForMonth(customerId, month);
  res.json(buildMonthlyIncome(trips, month, metaRoutes.loadRouteKmTable()));
}

module.exports = { getCustomerMonthlyIncome };
