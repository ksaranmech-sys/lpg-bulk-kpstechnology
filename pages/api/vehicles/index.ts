// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Vehicle from "../../../models/Vehicle";
import { z } from "zod";

const vehicleCreateSchema = z.object({ customerId: z.string().min(1), vehicleNumber: z.string().trim().min(2).max(30) });

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  if (req.method === "POST") {
    const parsed = vehicleCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid vehicle details" });
    const { customerId, vehicleNumber } = parsed.data;
    if (session.user.role === "admin" && customerId !== session.user.customerId) {
      return res.status(403).json({ error: "You can only add vehicles to your own fleet" });
    }
    if (session.user.role === "user") {
      return res.status(403).json({ error: "Vehicle users cannot add vehicles" });
    }
    if (!customerId || !vehicleNumber) {
      return res.status(400).json({ error: "Customer and vehicle number are required" });
    }
    const vehicle = await Vehicle.create({ customerId, vehicleNumber });
    return res.status(201).json(vehicle);
  }

  if (req.method === "GET") {
    const filter = {};
    // Each customer admin's feed is scoped strictly to their own customerId - they
    // will never see another customer's vehicles, matching "own fleets only."
    if (session.user.role === "admin") filter.customerId = session.user.customerId;
    if (session.user.role === "user") filter._id = session.user.assignedVehicle;
    if (session.user.role === "driver") filter.customerId = session.user.customerId;
    const vehicles = await Vehicle.find(filter);
    return res.status(200).json(vehicles);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
