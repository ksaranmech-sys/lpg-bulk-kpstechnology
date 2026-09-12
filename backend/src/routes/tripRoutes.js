const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tripController');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

router.use(requireAuth);

// Loads the trip once, checks the requesting user may access its vehicle,
// and stashes it on req.trip so controllers don't have to re-fetch it here.
async function scopeToTrip(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    if (req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)) return next();
    if (req.user.role === ROLES.VEHICLE_USER && String(trip.vehicle) === String(req.user.vehicle)) return next();

    return res.status(403).json({ error: 'Not allowed to access this trip' });
  } catch (err) {
    next(err);
  }
}

async function scopeToOpenTripForUser(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    if (req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)) return next();

    if (trip.status !== 'open') {
      return res.status(400).json({ error: 'Only open trips can be edited by the assigned user' });
    }

    const currentUser = req.user.role === ROLES.VEHICLE_USER
      ? await User.findById(req.user.id).select('role vehicle isActive')
      : null;
    const assignedVehicle = currentUser?.vehicle || req.user.vehicle;
    if (
      req.user.role === ROLES.VEHICLE_USER &&
      currentUser?.role === ROLES.VEHICLE_USER &&
      currentUser.isActive &&
      String(trip.vehicle) === String(assignedVehicle)
    ) {
      return next();
    }

    return res.status(403).json({ error: 'Only the assigned user can edit an open trip' });
  } catch (err) {
    next(err);
  }
}

router.get('/:tripId', scopeToTrip, ctrl.getTrip);
router.delete('/:tripId', (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.CUSTOMER_ADMIN) {
    return ctrl.deleteTrip(req, res, next);
  }
  return res.status(403).json({ error: 'Only customer admins and super admins can delete trip history' });
});
router.post('/:tripId/advances', scopeToOpenTripForUser, ctrl.addAdvance);
router.patch('/:tripId/advances/:advanceIndex', scopeToOpenTripForUser, ctrl.updateAdvance);
router.delete('/:tripId/advances/:advanceIndex', scopeToOpenTripForUser, ctrl.deleteAdvance);
router.post('/:tripId/diesel', scopeToOpenTripForUser, upload.single('photo'), ctrl.addDieselEntry);
router.patch('/:tripId/diesel/:dieselIndex', scopeToOpenTripForUser, ctrl.updateDieselEntry);
router.delete('/:tripId/diesel/:dieselIndex', scopeToOpenTripForUser, ctrl.deleteDieselEntry);
router.post('/:tripId/rto', scopeToOpenTripForUser, upload.single('photo'), ctrl.addRtoEntry);
router.patch('/:tripId/rto/:rtoIndex', scopeToOpenTripForUser, ctrl.updateRtoEntry);
router.post('/:tripId/other-expenses', scopeToOpenTripForUser, upload.single('photo'), ctrl.addOtherExpense);
router.patch('/:tripId/other-expenses/:expenseIndex', scopeToOpenTripForUser, ctrl.updateOtherExpense);
router.delete('/:tripId/other-expenses/:expenseIndex', scopeToOpenTripForUser, ctrl.deleteOtherExpense);
router.patch('/:tripId/loading', scopeToOpenTripForUser, ctrl.setLoadingDetails);
router.delete('/:tripId/loading-expense', scopeToOpenTripForUser, ctrl.deleteLoadingExpense);
router.patch('/:tripId/unloading', scopeToOpenTripForUser, ctrl.setUnloading);
router.post('/:tripId/close', scopeToOpenTripForUser, ctrl.closeTrip);
router.post('/:tripId/send-report', scopeToTrip, ctrl.sendReport);
router.get('/:tripId/report', scopeToTrip, ctrl.downloadReport);

module.exports = router;
