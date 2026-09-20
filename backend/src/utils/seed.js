const config = require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

// Creates the very first super_admin if none exists. Never touches an existing account - the
// old behaviour of resetting the password on every server start was a serious security hole.
async function ensureSeed() {
  const existing = await User.findOne({ role: ROLES.SUPER_ADMIN }).select('username');
  if (existing) return existing;

  if (!config.adminInitialPassword || config.adminInitialPassword.length < 8) {
    throw new Error('[seed] No super_admin exists yet. Set ADMIN_INITIAL_PASSWORD (8+ characters) in .env, start once, then remove it.');
  }

  const admin = new User({
    username: 'kpsadmin',
    name: 'KPS Technology Admin',
    role: ROLES.SUPER_ADMIN,
  });
  await admin.setPassword(config.adminInitialPassword);
  await admin.save();

  console.log('[seed] Created super_admin "kpsadmin" using ADMIN_INITIAL_PASSWORD. Log in and change it, then remove ADMIN_INITIAL_PASSWORD from .env.');
  return admin;
}

// Emergency recovery only: `npm run seed -- --reset-admin-password` sets kpsadmin's password to
// ADMIN_INITIAL_PASSWORD. Requires direct access to the server/database, so it is not exposed via
// the API.
async function resetAdminPassword() {
  if (!config.adminInitialPassword || config.adminInitialPassword.length < 8) {
    throw new Error('[seed] ADMIN_INITIAL_PASSWORD (8+ characters) must be set to reset the admin password.');
  }
  const admin = await User.findOne({ role: ROLES.SUPER_ADMIN }).sort('createdAt');
  if (!admin) throw new Error('[seed] No super_admin found to reset.');
  await admin.setPassword(config.adminInitialPassword);
  admin.tokenVersion = (admin.tokenVersion || 0) + 1;
  admin.isActive = true;
  await admin.save();
  console.log(`[seed] Password reset for super_admin "${admin.username}". Log in and change it now.`);
}

async function seed() {
  await connectDB();
  if (process.argv.includes('--reset-admin-password')) {
    await resetAdminPassword();
  } else {
    await ensureSeed();
  }
  process.exit(0);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { ensureSeed, resetAdminPassword, seed };
