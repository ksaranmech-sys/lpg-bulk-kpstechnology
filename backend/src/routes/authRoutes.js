const express = require('express');
const router = express.Router();
const {
  login, refresh, logout, me, resetUserPassword, changePassword,
  setRecoveryContact, forgotPassword, resetPasswordWithCode,
} = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rules } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { ROLES } = require('../config/constants');

router.post('/login', loginLimiter, rules.login, login);
router.post('/refresh', loginLimiter, rules.refresh, refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, rules.changePassword, changePassword);
router.post('/recovery-contact', requireAuth, rules.recoveryContact, setRecoveryContact);
// Public, rate-limited like login: username + recovery mobile -> emailed code -> new password.
router.post('/forgot-password', loginLimiter, rules.forgotPassword, forgotPassword);
router.post('/reset-password-with-code', loginLimiter, rules.resetPasswordWithCode, resetPasswordWithCode);
router.post('/reset-password', requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), rules.resetPassword, resetUserPassword);

module.exports = router;
