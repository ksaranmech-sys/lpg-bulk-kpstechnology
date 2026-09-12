require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

async function seed() {
  await connectDB();

  const existing = await User.findOne({ role: ROLES.SUPER_ADMIN });
  if (existing) {
    console.log(`Super admin already exists: ${existing.username}`);
    process.exit(0);
  }

  const admin = new User({
    username: 'kpsadmin',
    name: 'KPS Technology Admin',
    role: ROLES.SUPER_ADMIN,
  });
  await admin.setPassword('ChangeMe123'); // change immediately after first login
  await admin.save();

  console.log('Created super_admin -> username: kpsadmin  password: ChangeMe123');
  console.log('IMPORTANT: log in and change this password immediately.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
