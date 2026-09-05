// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions, canAccessVehicle } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Vehicle from "../../../models/Vehicle";
import { documentUpdateSchema } from "../../../lib/validation";

// GET  /api/vehicles/:id       -> fetch one vehicle (role-scoped)
// PATCH /api/vehicles/:id      -> update document expiry dates for a vehicle.
//   This is how a customer admin "modifies their own fleet": they can edit the
//   9 document expiry dates on any vehicle under their own customerId, but the
//   vehicle number itself and customerId are only ever set by KPS staff (see
//   pages/api/vehicles/index.js).
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  const vehicle = await Vehicle.findById(req.query.id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  if (!canAccessVehicle(session.user, vehicle)) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    return res.status(200).json(vehicle);
  }

  if (req.method === "PATCH") {
    // A "user" (single-vehicle driver login) can view but not edit document dates -
    // only superadmin or the owning customer's admin can.
    if (session.user.role === "user" || session.user.role === "driver") return res.status(403).json({ error: "Forbidden" });

    const parsed = documentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid document dates" });
    const { documents } = parsed.data;
    for (const [field, patch] of Object.entries(documents || {})) {
      if (!vehicle.documents[field]) continue;
      if (patch.expiryDate) vehicle.documents[field].expiryDate = patch.expiryDate;
    }
    await vehicle.save();
    return res.status(200).json(vehicle);
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).end();
}
