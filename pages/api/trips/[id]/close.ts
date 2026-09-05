// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions, canAccessVehicle } from "../../../../lib/auth";
import { dbConnect } from "../../../../lib/mongodb";
import Trip from "../../../../models/Trip";
import Vehicle from "../../../../models/Vehicle";
import Customer from "../../../../models/Customer";
import { calculateTripSettlement } from "../../../../lib/tripCalculations";
import { buildTripPdf } from "../../../../lib/tripPdf";
import { sendTripReport } from "../../../../lib/email";

// POST /api/trips/:id/close
// Body: { unloadingLocation, unloadingExpense }
// Expects the closing diesel fill to have ALREADY been added via /diesel first
// (that fill, made at the next loading point, is what triggers this step in the UI).
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

  const { unloadingLocation, unloadingExpense } = req.body;
  trip.unloadingLocation = unloadingLocation;
  trip.unloadingExpense = unloadingExpense || 0;

  const settlement = calculateTripSettlement(trip);
  trip.settlement = settlement;
  trip.status = "closed";
  trip.closedAt = new Date();
  await trip.save();

  const customer = await Customer.findById(trip.customerId);
  try {
    const pdfBuffer = await buildTripPdf(trip, vehicle.vehicleNumber);
    await sendTripReport({
      to: customer.email,
      vehicleNumber: vehicle.vehicleNumber,
      tripId: trip._id.toString(),
      pdfBuffer,
    });
  } catch (err) {
    // Don't fail the whole request if email delivery has an issue - the trip is
    // already settled and saved; surface the email error separately.
    console.error("Trip report email failed:", err);
    return res.status(200).json({ trip, emailError: err.message });
  }

  return res.status(200).json({ trip });
}
