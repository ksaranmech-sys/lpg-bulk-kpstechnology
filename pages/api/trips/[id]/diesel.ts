// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions, canAccessVehicle } from "../../../../lib/auth";
import { dbConnect } from "../../../../lib/mongodb";
import Trip from "../../../../models/Trip";
import Vehicle from "../../../../models/Vehicle";
import { dieselEntrySchema } from "../../../../lib/validation";

// POST /api/trips/:id/diesel  -> add a diesel fill entry.
// Body: { volume, rate, odometerKm?, photo: { url, gps } }
// If body.closeTrip === true, this fill is treated as the fill made at the NEXT
// loading location, which closes the current trip and triggers settlement + email.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  const trip = await Trip.findById(req.query.id);
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const vehicle = await Vehicle.findById(trip.vehicleId);
  if (!canAccessVehicle(session.user, vehicle)) return res.status(403).json({ error: "Forbidden" });
  if (trip.status !== "open") return res.status(400).json({ error: "Trip already closed" });

  const parsed = dieselEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid diesel entry" });
  const { volume, rate, odometerKm, photo } = parsed.data;
  trip.dieselFills.push({ volume, rate, value: volume * rate, odometerKm, photo });
  await trip.save();

  return res.status(200).json(trip);
}
