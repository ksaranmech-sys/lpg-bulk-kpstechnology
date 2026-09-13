require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

async function ensureSeed() {
  const existing = await User.findOne({ role: ROLES.SUPER_ADMIN });
  if (existing) {
    return existing;
  }

  const admin = new User({
    username: 'kpsadmin',
    name: 'KPS Technology Admin',
    role: ROLES.SUPER_ADMIN,
  });
  await admin.setPassword('ChangeMe@123'); // change immediately after first login
  await admin.save();

  console.log('[seed] Created super_admin -> username: kpsadmin | password: ChangeMe@123');
  return admin;
}

async function seed() {
  await connectDB();
  await ensureSeed();
  console.log('IMPORTANT: log in and change this password immediately.');
  process.exit(0);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureSeed, seed };
