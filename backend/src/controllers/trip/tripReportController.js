// Trip settlement report handlers: email and inline PDF download.
const Trip = require('../../models/Trip');
const { buildTripSettlementPdf } = require('../../utils/pdfGenerator');
const { sendTripSettlementEmail } = require('../../utils/mailer');
const { TRIP_STATUS } = require('../../config/constants');
const { refreshTripSettlement } = require('./tripHelpers');

// POST /api/v1/trips/:tripId/send-report
// Generates the printable PDF settlement and emails it to the company (and
// optionally the customer). Trip must already be closed/settled.
async function sendReport(req, res) {
  const trip = await Trip.findById(req.params.tripId)
    .populate('vehicle', 'vehicleNumber')
    .populate('customer', 'companyName email');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const nextTrip = await Trip.findOne({
    vehicle: trip.vehicle._id,
    createdAt: { $gt: trip.createdAt },
  }).sort('createdAt');

  if (trip.status !== TRIP_STATUS.CLOSED || !trip.settlement?.calculatedAt) {
    return res.status(400).json({
      error: 'Trip is not settled yet - it closes automatically once the next trip records its first diesel fill.',
    });
  }

  const pdfBuffer = await buildTripSettlementPdf(trip, nextTrip);
  const companyEmail = process.env.COMPANY_EMAIL;
  const customerEmail = trip.customer?.email;

  const info = await sendTripSettlementEmail({
    to: companyEmail,
    cc: customerEmail,
    subject: `Trip Settlement Report - ${trip.vehicle?.vehicleNumber} - ${trip._id}`,
    html: `<p>Attached is the settlement report for vehicle <b>${trip.vehicle?.vehicleNumber}</b>.</p>`,
    pdfBuffer,
    pdfFilename: `trip-settlement-${trip._id}.pdf`,
  });

  trip.reportSentAt = new Date();
  trip.reportSentTo = [companyEmail, customerEmail].filter(Boolean).join(', ');
  await trip.save();

  res.json({ message: 'Report emailed successfully', messageId: info.messageId });
}

// GET /api/v1/trips/:tripId/report  -> streams the PDF directly (for on-screen "print" button)
async function downloadReport(req, res) {
  const trip = await Trip.findById(req.params.tripId)
    .populate('vehicle', 'vehicleNumber')
    .populate('customer', 'companyName email');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status === TRIP_STATUS.CLOSED) await refreshTripSettlement(trip);
  const nextTrip = await Trip.findOne({
    vehicle: trip.vehicle._id,
    createdAt: { $gt: trip.createdAt },
  }).sort('createdAt');

  const pdfBuffer = await buildTripSettlementPdf(trip, nextTrip);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="trip-${trip._id}.pdf"`);
  res.send(pdfBuffer);
}

module.exports = {
  sendReport,
  downloadReport,
};
