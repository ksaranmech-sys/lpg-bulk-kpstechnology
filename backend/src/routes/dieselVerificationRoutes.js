const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const ctrl = require('../controllers/dieselVerificationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.xlsx', '.csv'].includes(extension)) {
      return callback(Object.assign(new Error('Only PDF, Excel (.xlsx), and CSV files are allowed'), { status: 400 }));
    }
    return callback(null, true);
  },
});

router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN));
router.get('/', ctrl.listDieselVerifications);
router.post('/', reportUpload.single('file'), ctrl.createDieselVerification);
router.get('/:verificationId/file', ctrl.downloadDieselVerification);
router.delete('/:verificationId', ctrl.deleteDieselVerification);

module.exports = router;
