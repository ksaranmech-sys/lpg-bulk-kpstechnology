const User = require('../models/User');
const Customer = require('../models/Customer');
const { ROLES } = require('../config/constants');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

function issueTokens(user) {
  return { token: signAccessToken(user), refreshToken: signRefreshToken(user) };
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

module.exports = { login, refresh, logout, me, resetUserPassword, changePassword };
