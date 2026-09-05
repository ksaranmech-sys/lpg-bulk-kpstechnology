// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Driver from "../../../models/Driver";
import User from "../../../models/User";
import bcrypt from "bcryptjs";
import { driverOnboardingSchema } from "../../../lib/validation";
import { canAccessVehicle } from "../../../lib/auth";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  if (req.method === "GET") {
    const filter = { active: true };
    if (session.user.role === "admin" || session.user.role === "user" || session.user.role === "driver") filter.customerId = session.user.customerId;
    if (req.query.customerId && session.user.role === "superadmin") filter.customerId = req.query.customerId;
    return res.status(200).json(await Driver.find(filter).sort({ name: 1 }));
  }

  if (req.method === "POST") {
    if (!["superadmin", "admin"].includes(session.user.role)) return res.status(403).json({ error: "Only customer admins can onboard drivers" });
    const parsed = driverOnboardingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid driver details" });
    const { customerId, name, mobileNumber, licenseNumber, username, password } = parsed.data;
    const driverCustomerId = session.user.role === "admin" ? session.user.customerId : customerId;
    if (session.user.role === "admin" && driverCustomerId !== customerId) return res.status(403).json({ error: "You can only onboard drivers for your customer" });
    if (!driverCustomerId || !name || !mobileNumber) return res.status(400).json({ error: "Customer, driver name, and mobile number are required" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, role: "driver", customerId: driverCustomerId, active: true });
    return res.status(201).json(await Driver.create({ customerId: driverCustomerId, name, mobileNumber, licenseNumber, userId: user._id }));
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}