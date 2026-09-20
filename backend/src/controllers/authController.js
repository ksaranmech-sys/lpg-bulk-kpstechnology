const crypto = require('crypto');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { ROLES } = require('../config/constants');
const config = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { sendPasswordResetCodeEmail } = require('../utils/mailer');

const RESET_CODE_MINUTES = 10;
const RESET_MAX_ATTEMPTS = 5;
const FORGOT_RESPONSE = { message: 'If the details match an account with recovery contacts, a reset code has been emailed.' };

function issueTokens(user) {
  return { token: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

// Compare phone numbers by their last 10 digits so "+91 98765 43210" matches "9876543210".
function mobileKey(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function hashResetCode(code) {
  return crypto.createHmac('sha256', config.jwt.secret).update(String(code)).digest('hex');
}

// POST /api/v1/auth/login  { username, password }
// Used identically by the website and the mobile app.
async function login(req, res) {
  const { username, password } = req.body;

  const user = await User.findOne({ username: username.toLowerCase(), isActive: true });
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  if (user.customer) {
    const customer = await Customer.findOne({ _id: user.customer, isActive: true });
    if (!customer) return res.status(403).json({ error: 'Customer account is blocked' });
  }

  const valid = await user.checkPassword(password);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ ...issueTokens(user), user: user.toSafeJSON() });
}

// POST /api/v1/auth/refresh  { refreshToken }
// Exchanges a valid refresh token for a new access + refresh token pair (rotation).
async function refresh(req, res) {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await User.findOne({ _id: payload.id, isActive: true });
  if (!user || (user.tokenVersion || 0) !== payload.tv) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
  if (user.customer) {
    const customer = await Customer.findOne({ _id: user.customer, isActive: true }).select('_id');
    if (!customer) return res.status(403).json({ error: 'Customer account is blocked' });
  }

  res.json({ ...issueTokens(user), user: user.toSafeJSON() });
}

// POST /api/v1/auth/logout
// Invalidates every refresh token for this user (all devices). Access tokens expire on their own.
async function logout(req, res) {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.json({ message: 'Logged out' });
}

// GET /api/v1/auth/me
async function me(req, res) {
  const user = await User.findById(req.user.id).populate('customer', 'companyName email').populate('vehicle', 'vehicleNumber');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}

// POST /api/v1/auth/reset-password  { userId, newPassword }
// super_admin: any user. customer_admin: only vehicle_users under their own customer.
async function resetUserPassword(req, res) {
  const { userId, newPassword } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.user.role === ROLES.CUSTOMER_ADMIN) {
    const sameCustomer = String(user.customer) === String(req.user.customer);
    if (!sameCustomer || user.role !== ROLES.VEHICLE_USER) {
      return res.status(403).json({ error: 'You can only reset passwords for drivers under your own account' });
    }
  }

  await user.setPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // sign the user out everywhere
  await user.save();

  res.json({ message: 'Password reset successfully', user: user.toSafeJSON() });
}

// POST /api/v1/auth/change-password  { currentPassword, newPassword }
// Any signed-in user changes their own password; other sessions are signed out.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await user.checkPassword(currentPassword);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  await user.setPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  res.json({ message: 'Password changed successfully', ...issueTokens(user) });
}

// POST /api/v1/auth/recovery-contact  { currentPassword, recoveryEmail, recoveryMobile }
// Sets where reset codes go. Requires the current password so a stolen session can't redirect them.
async function setRecoveryContact(req, res) {
  const { currentPassword, recoveryEmail, recoveryMobile } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!(await user.checkPassword(currentPassword))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.recoveryEmail = recoveryEmail.toLowerCase();
  user.recoveryMobile = recoveryMobile;
  await user.save();

  res.json({ message: 'Recovery contacts saved', user: user.toSafeJSON() });
}

// POST /api/v1/auth/forgot-password  { username, recoveryMobile }
// Emails a one-time code if the username exists AND the mobile number matches the saved recovery
// number. The response is identical either way so usernames can't be probed.
async function forgotPassword(req, res) {
  const { username, recoveryMobile } = req.body;

  const user = await User.findOne({ username: username.toLowerCase(), isActive: true });
  const matches = user
    && user.recoveryEmail
    && user.recoveryMobile
    && mobileKey(user.recoveryMobile) === mobileKey(recoveryMobile);
  if (!matches) return res.json(FORGOT_RESPONSE);

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.passwordReset = {
    codeHash: hashResetCode(code),
    expiresAt: new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000),
    attempts: 0,
  };
  await user.save();

  try {
    await sendPasswordResetCodeEmail({ to: user.recoveryEmail, name: user.name, code, minutesValid: RESET_CODE_MINUTES });
  } catch (err) {
    console.error('[auth] Failed to send reset code email:', err.message);
    return res.status(502).json({ error: 'Could not send the reset email. Please try again later or contact KPS Technology.' });
  }

  res.json(FORGOT_RESPONSE);
}

// POST /api/v1/auth/reset-password-with-code  { username, code, newPassword }
async function resetPasswordWithCode(req, res) {
  const { username, code, newPassword } = req.body;
  const invalid = () => res.status(400).json({ error: 'Invalid or expired reset code' });

  const user = await User.findOne({ username: username.toLowerCase(), isActive: true });
  const reset = user?.passwordReset;
  if (!reset?.codeHash || !reset.expiresAt || reset.expiresAt < new Date()) return invalid();

  if (reset.attempts >= RESET_MAX_ATTEMPTS) {
    user.passwordReset = { codeHash: null, expiresAt: null, attempts: 0 };
    await user.save();
    return invalid();
  }

  const expected = Buffer.from(reset.codeHash, 'hex');
  const actual = Buffer.from(hashResetCode(code), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    user.passwordReset.attempts = reset.attempts + 1;
    await user.save();
    return invalid();
  }

  await user.setPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.passwordReset = { codeHash: null, expiresAt: null, attempts: 0 };
  await user.save();

  res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
}

module.exports = {
  login, refresh, logout, me, resetUserPassword, changePassword,
  setRecoveryContact, forgotPassword, resetPasswordWithCode,
};
