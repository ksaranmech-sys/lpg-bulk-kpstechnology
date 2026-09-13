require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

async function ensureSeed() {
  let admin = await User.findOne({ username: 'kpsadmin' });
  if (!admin) {
    admin = await User.findOne({ role: ROLES.SUPER_ADMIN });
  }

  if (!admin) {
    admin = new User({
      username: 'kpsadmin',
      name: 'KPS Technology Admin',
      role: ROLES.SUPER_ADMIN,
    });
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe@123';
  await admin.setPassword(initialPassword);
  admin.isActive = true;
  await admin.save();

  console.log(`[seed] Ensured super_admin -> username: kpsadmin | password: ${initialPassword}`);
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
