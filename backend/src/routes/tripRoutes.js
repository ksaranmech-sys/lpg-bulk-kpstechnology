const express = require('express');
const { ROLES } = require('../config/constants');
const ctrl = require('../controllers/tripController');
const { requireAuth } = require('../middleware/auth');
const { scopeToTrip, scopeToOpenTripForUser, scopeToTripClose } = require('../middleware/tripAccess');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/:tripId', scopeToTrip, ctrl.getTrip);
router.delete('/:tripId', (req, res, next) => {
  if (
    req.user.role === ROLES.SUPER_ADMIN ||
    req.user.role === ROLES.CUSTOMER_ADMIN
  ) {
    return ctrl.deleteTrip(req, res, next);
  }
  return res.status(403).json({ error: 'Only customer admins and super admins can delete trip history' });
});
router.post('/:tripId/advances', scopeToOpenTripForUser, ctrl.addAdvance);
router.patch('/:tripId/advances/:advanceIndex', scopeToOpenTripForUser, ctrl.updateAdvance);
router.delete('/:tripId/advances/:advanceIndex', scopeToOpenTripForUser, ctrl.deleteAdvance);
router.post(
  '/:tripId/diesel',
  scopeToOpenTripForUser,
  upload.single('photo'),
  ctrl.addDieselEntry,
);
router.patch('/:tripId/diesel/:dieselIndex', scopeToOpenTripForUser, ctrl.updateDieselEntry);
router.delete('/:tripId/diesel/:dieselIndex', scopeToOpenTripForUser, ctrl.deleteDieselEntry);
router.post(
  '/:tripId/rto',
  scopeToOpenTripForUser,
  upload.single('photo'),
  ctrl.addRtoEntry,
);
router.patch('/:tripId/rto/:rtoIndex', scopeToOpenTripForUser, ctrl.updateRtoEntry);
router.post(
  '/:tripId/other-expenses',
  scopeToOpenTripForUser,
  upload.single('photo'),
  ctrl.addOtherExpense,
);
router.patch('/:tripId/other-expenses/:expenseIndex', scopeToOpenTripForUser, ctrl.updateOtherExpense);
router.delete('/:tripId/other-expenses/:expenseIndex', scopeToOpenTripForUser, ctrl.deleteOtherExpense);
router.patch('/:tripId/loading', scopeToOpenTripForUser, upload.single('parkingPhoto'), ctrl.setLoadingDetails);
router.delete('/:tripId/loading-expense', scopeToOpenTripForUser, ctrl.deleteLoadingExpense);
router.patch('/:tripId/unloading', scopeToOpenTripForUser, ctrl.setUnloading);
router.patch('/:tripId/turn', scopeToOpenTripForUser, ctrl.setTurnDetails);
router.patch('/:tripId/unloading-turn', scopeToOpenTripForUser, ctrl.setUnloadingTurnDetails);
router.delete('/:tripId/unloading-turn', scopeToOpenTripForUser, ctrl.deleteUnloadingTurnDetails);
router.post('/:tripId/close', scopeToTripClose, ctrl.closeTrip);
router.post('/:tripId/send-report', scopeToTrip, ctrl.sendReport);
router.get('/:tripId/report', scopeToTrip, ctrl.downloadReport);

module.exports = router;
