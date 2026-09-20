// Driver monthly salary endpoints: JSON summary, PDF token, PDF download.
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const { buildDriverMonthlySummaryPdf, formatMonth } = require('../utils/pdfGenerator');
const { signPdfToken } = require('../middleware/auth');
const {
  getLatestCalculableSalaryMonth,
  validateSalaryMonth,
  calculateDriverMonthlySalary,
} = require('../utils/salary');

// GET /api/v1/customers/:customerId/users/:userId/salary?month=YYYY-MM
async function getDriverMonthlySalary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });

  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  const { driver, detailTrips, ...response } = summary;
  res.json(response);
}

// POST /api/v1/customers/:customerId/users/:userId/monthly-summary/token?month=YYYY-MM
// Issues a short-lived token so the browser can open the PDF URL directly in a new tab and
// pick up the Content-Disposition filename (blob URLs always save as a random UUID).
async function createDriverMonthlySummaryToken(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  const token = signPdfToken(req.user, { customerId, userId, month });
  res.json({ token });
}

// GET /api/v1/customers/:customerId/users/:userId/monthly-summary?month=YYYY-MM
async function downloadDriverMonthlySummary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  if (req.user.scope && (req.user.customerId !== customerId || req.user.userId !== userId || req.user.month !== month)) {
    return res.status(403).json({ error: 'Token is not valid for this report' });
  }
  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  const [vehicle, customer] = await Promise.all([
    summary.driver.vehicle ? Vehicle.findById(summary.driver.vehicle).select('vehicleNumber') : null,
    Customer.findById(customerId).select('companyName'),
  ]);
  const pdfBuffer = await buildDriverMonthlySummaryPdf({
    driver: summary.driver,
    vehicle,
    customer,
    summary,
    trips: summary.trips,
    detailTrips: summary.detailTrips,
  });
  const cleanFilenamePart = (value) => String(value || 'Unknown').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  const monthlyFilename = [
    cleanFilenamePart(customer?.companyName),
    cleanFilenamePart(summary.driver?.name || summary.driver?.username),
    cleanFilenamePart(formatMonth(month)),
  ].join('-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${monthlyFilename}.pdf"`);
  res.send(pdfBuffer);
}

module.exports = {
  getDriverMonthlySalary,
  createDriverMonthlySummaryToken,
  downloadDriverMonthlySummary,
};
