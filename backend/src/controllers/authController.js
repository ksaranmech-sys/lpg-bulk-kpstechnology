const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { ROLES } = require('../config/constants');

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      customer: user.customer,
      vehicle: user.vehicle,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/v1/auth/login  { username, password }
// Used identically by the website and (later) the mobile app.
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

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

  const token = signToken(user);
  res.json({ token, user: user.toSafeJSON() });
}

// GET /api/v1/auth/me
async function me(req, res) {
  const user = await User.findById(req.user.id).populate('customer', 'companyName email').populate('vehicle', 'vehicleNumber');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}

// POST /api/v1/auth/reset-password
// body: { userId, newPassword }
async function resetUserPassword(req, res) {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword are required' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === ROLES.SUPER_ADMIN && req.user?.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Only super admin can reset super admin credentials' });
  }

  await user.setPassword(newPassword);
  await user.save();

  res.json({ message: 'Password reset successfully', user: user.toSafeJSON() });
}

// POST /api/v1/auth/reset-all-admin-passwords
// body: { newPassword }
async function resetAllAdminPasswords(req, res) {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: 'newPassword is required' });
  }

  const rolesToReset = [ROLES.CUSTOMER_ADMIN, ROLES.SUPER_ADMIN];
  const users = await User.find({ role: { $in: rolesToReset } });

  if (!users.length) {
    return res.status(404).json({ error: 'No admin users found to reset' });
  }

  await Promise.all(users.map(async (user) => {
    await user.setPassword(newPassword);
    await user.save();
  }));

  res.json({
    message: 'Passwords reset successfully for all admin users',
    updatedCount: users.length,
    usernames: users.map((user) => user.username),
  });
}

module.exports = { login, me, resetUserPassword, resetAllAdminPasswords };
