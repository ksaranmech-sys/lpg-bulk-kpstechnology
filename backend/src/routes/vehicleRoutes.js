const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehicleController');
const tripCtrl = require('../controllers/tripController');
const { requireAuth, scopeToVehicle } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Vehicle = require('../models/Vehicle');

router.use(requireAuth);

const vehicleScope = scopeToVehicle(async (vehicleId) => {
  const v = await Vehicle.findById(vehicleId);
  if (!v) throw Object.assign(new Error('Vehicle not found'), { status: 404 });
  return { customerId: v.customer };
});

router.get('/', ctrl.listVehicles);
router.get('/:vehicleId', vehicleScope, ctrl.getVehicle);
router.patch('/:vehicleId', vehicleScope, ctrl.updateVehicle);
router.delete('/:vehicleId', vehicleScope, ctrl.deleteVehicle);
router.patch('/:vehicleId/document-reminders', vehicleScope, ctrl.updateVehicleReminderDates);
router.post('/:vehicleId/reminders/send', vehicleScope, ctrl.sendVehicleReminder);

// Trips nested under vehicle
router.post('/:vehicleId/trips', vehicleScope, tripCtrl.createTrip);
router.get('/:vehicleId/trips', vehicleScope, tripCtrl.listTripsForVehicle);

module.exports = router;
