const express = require('express');
const router = express.Router();
const { login, me, resetUserPassword, resetAllAdminPasswords } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/reset-password', requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), resetUserPassword);
router.post('/reset-all-admin-passwords', requireAuth, requireRole(ROLES.SUPER_ADMIN), resetAllAdminPasswords);

module.exports = router;
