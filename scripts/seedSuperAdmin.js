// One-time script to create the first login before any UI exists.
// Run locally with: node scripts/seedSuperAdmin.js
process.loadEnvFile();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.models.User || mongoose.model(
    "User",
    new mongoose.Schema({ username: String, passwordHash: String, role: String, active: Boolean })
  );

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await User.create({ username: "kpsadmin", passwordHash, role: "superadmin", active: true });
  console.log("Superadmin created: kpsadmin / ChangeMe123!  (change this password immediately)");
  process.exit(0);
}

main();
