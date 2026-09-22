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
  const { driver, ...response } = summary;
  res.json(response);
}

// `driver` query param picks whose PDF to build: the regular driver (default) or the temporary driver.
function getPdfTarget(req) {
  return req.query.driver === 'temporary' ? 'temporary' : 'regular';
}

// POST /api/v1/customers/:customerId/users/:userId/monthly-summary/token?month=YYYY-MM&driver=regular|temporary
// Issues a short-lived token so the browser can open the PDF URL directly in a new tab and
// pick up the Content-Disposition filename (blob URLs always save as a random UUID).
async function createDriverMonthlySummaryToken(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  const token = signPdfToken(req.user, { customerId, userId, month, which: getPdfTarget(req) });
  res.json({ token });
}

// GET /api/v1/customers/:customerId/users/:userId/monthly-summary?month=YYYY-MM&driver=regular|temporary
async function downloadDriverMonthlySummary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const which = getPdfTarget(req);
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  if (req.user.scope && (req.user.customerId !== customerId || req.user.userId !== userId || req.user.month !== month || (req.user.which || 'regular') !== which)) {
    return res.status(403).json({ error: 'Token is not valid for this report' });
  }
  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  if (which === 'temporary' && !summary.temporaryDriver) {
    return res.status(404).json({ error: 'No temporary driver is recorded for this month' });
  }
  const [vehicle, customer] = await Promise.all([
    summary.driver.vehicle ? Vehicle.findById(summary.driver.vehicle).select('vehicleNumber') : null,
    Customer.findById(customerId).select('companyName'),
  ]);
  const pdfBuffer = await buildDriverMonthlySummaryPdf({
    driver: summary.driver,
    vehicle,
    customer,
    summary,
    which,
  });
  const cleanFilenamePart = (value) => String(value || 'Unknown').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  const personName = which === 'temporary'
    ? `${summary.temporaryDriver.name}-Temporary`
    : (summary.driver?.name || summary.driver?.username);
  const monthlyFilename = [
    cleanFilenamePart(customer?.companyName),
    cleanFilenamePart(personName),
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
