const crypto = require('crypto');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { ROLES } = require('../config/constants');
const config = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { sendPasswordResetLinkEmail } = require('../utils/mailer');

const RESET_LINK_MINUTES = 30;
const FORGOT_RESPONSE = { message: 'If the details match an account, a password reset link has been emailed to the recovery address.' };

function issueTokens(user) {
  return { token: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function hashResetToken(token) {
  return crypto.createHmac('sha256', config.jwt.secret).update(String(token)).digest('hex');
}

// Self-service "forgot password" exists only for super admins (nobody above them can reset it).
// Customer admins are reset by KPS, and drivers by their customer admin, via /auth/reset-password.
function canSelfRecover(user) {
  return user.role === ROLES.SUPER_ADMIN;
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

// POST /api/v1/auth/recovery-contact  { currentPassword, recoveryEmail }
// Sets where reset links go. Requires the current password so a stolen session can't redirect them.
async function setRecoveryContact(req, res) {
  const { currentPassword, recoveryEmail } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!canSelfRecover(user)) {
    return res.status(403).json({ error: 'Password recovery email is only available for KPS super admin accounts. Ask your administrator to reset your password.' });
  }
  if (!(await user.checkPassword(currentPassword))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.recoveryEmail = emailKey(recoveryEmail);
  await user.save();

  res.json({ message: 'Recovery email saved', user: user.toSafeJSON() });
}

// POST /api/v1/auth/forgot-password  { username, recoveryEmail }
// Emails a one-time reset link if the username exists AND the email matches the recovery address.
// The response is identical either way so usernames can't be probed.
async function forgotPassword(req, res) {
  const { username, recoveryEmail } = req.body;

  const user = await User.findOne({ username: username.toLowerCase(), isActive: true });
  const email = user && canSelfRecover(user) ? user.recoveryEmail : null;
  if (!email || emailKey(email) !== emailKey(recoveryEmail)) return res.json(FORGOT_RESPONSE);

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordReset = {
    codeHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000),
    attempts: 0,
  };
  await user.save();

  const resetUrl = `${config.appBaseUrl}/reset-password?token=${token}`;
  try {
    await sendPasswordResetLinkEmail({ to: email, name: user.name, resetUrl, minutesValid: RESET_LINK_MINUTES });
  } catch (err) {
    console.error('[auth] Failed to send reset link email:', err.response || err.message);
    console.error('[auth] Check SMTP_* in backend/.env with "npm run mail:check".');
    return res.status(502).json({ error: 'Could not send the reset email. Please try again later or contact KPS Technology.' });
  }

  res.json(FORGOT_RESPONSE);
}

// POST /api/v1/auth/reset-password-with-token  { token, newPassword }
// The token comes from the emailed link; it is single-use and expires after RESET_LINK_MINUTES.
async function resetPasswordWithToken(req, res) {
  const { token, newPassword } = req.body;
  const invalid = () => res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

  const user = await User.findOne({
    'passwordReset.codeHash': hashResetToken(token),
    'passwordReset.expiresAt': { $gt: new Date() },
    isActive: true,
  });
  if (!user || !canSelfRecover(user)) return invalid();

  await user.setPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.passwordReset = { codeHash: null, expiresAt: null, attempts: 0 };
  await user.save();

  res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
}

module.exports = {
  login, refresh, logout, me, resetUserPassword, changePassword,
  setRecoveryContact, forgotPassword, resetPasswordWithToken,
};
