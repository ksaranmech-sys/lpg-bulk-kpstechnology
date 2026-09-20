const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leaveController');
const { requireAuth } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Every role may use leave endpoints; the controller scopes what each role can see/edit.
router.use(requireAuth);

router.get('/', ctrl.listLeaves);
router.post('/', rules.createLeave, ctrl.createLeave);
router.patch('/:leaveId', rules.updateLeave, ctrl.updateLeave);
router.delete('/:leaveId', rules.leaveId, ctrl.deleteLeave);

module.exports = router;
