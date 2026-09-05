// @ts-nocheck
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import User from "../../../models/User";
import Vehicle from "../../../models/Vehicle";
import { vehicleUserSchema } from "../../../lib/validation";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).end();
  if (!["superadmin", "admin"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });

  await dbConnect();
  const parsed = vehicleUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid user details" });
  const { username, password, vehicleId } = parsed.data;
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  if (session.user.role === "admin" && session.user.customerId !== vehicle.customerId.toString()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: "user", customerId: vehicle.customerId, assignedVehicle: vehicle._id });
  return res.status(201).json({ id: user._id, username: user.username, vehicleId: vehicle._id });
}