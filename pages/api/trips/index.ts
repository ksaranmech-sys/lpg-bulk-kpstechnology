// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions, canAccessVehicle } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Trip from "../../../models/Trip";
import Vehicle from "../../../models/Vehicle";
import Driver from "../../../models/Driver";
import User from "../../../models/User";
import { tripStartSchema } from "../../../lib/validation";
import Customer from "../../../models/Customer";
import { calculateTripSettlement } from "../../../lib/tripCalculations";
import { buildTripPdf } from "../../../lib/tripPdf";
import { sendTripReport } from "../../../lib/email";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  if (req.method === "POST") {
    // Start a new trip: advance, loading location, loading expense, and the first
    // (carry-over) diesel fill are supplied together.
    const parsed = tripStartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid trip details" });
    let { vehicleId, driverId, driverAdvance, loadingLocation, loadingExpense, firstDieselFill, previousUnloadingLocation, previousUnloadingExpense } = parsed.data;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (!canAccessVehicle(session.user, vehicle)) return res.status(403).json({ error: "Forbidden" });

    if (session.user.role === "driver" && !driverId) {
      const ownDriver = await Driver.findOne({ userId: session.user.id, customerId: vehicle.customerId, active: true });
      if (ownDriver) driverId = ownDriver._id.toString();
      else {
        const driverUser = await User.findById(session.user.id);
        const fallbackDriver = await Driver.findOne({ userId: driverUser?._id, customerId: vehicle.customerId, active: true });
        driverId = fallbackDriver?._id?.toString();
      }
      if (!driverId) return res.status(400).json({ error: "Your login is not linked to a driver profile" });
    }

    if (driverId) {
      const driver = await Driver.findOne({ _id: driverId, customerId: vehicle.customerId, active: true });
      if (!driver) return res.status(400).json({ error: "Driver is not part of this customer fleet" });
    }

    const previousTrip = await Trip.findOne({ vehicleId, status: "open" }).sort({ createdAt: -1 });
    if (previousTrip && !firstDieselFill) {
      return res.status(400).json({ error: "The next trip needs its first diesel fill to close the previous trip" });
    }
    if (previousTrip) {
      previousTrip.dieselFills.push({ ...firstDieselFill, value: firstDieselFill.volume * firstDieselFill.rate });
      previousTrip.unloadingLocation = previousUnloadingLocation || loadingLocation;
      previousTrip.unloadingExpense = previousUnloadingExpense || 0;
      previousTrip.settlement = calculateTripSettlement(previousTrip);
      previousTrip.status = "closed";
      previousTrip.closedAt = new Date();
      await previousTrip.save();

      const customer = await Customer.findById(previousTrip.customerId);
      try {
        const pdfBuffer = await buildTripPdf(previousTrip, vehicle.vehicleNumber);
        await sendTripReport({ to: customer.email, vehicleNumber: vehicle.vehicleNumber, tripId: previousTrip._id.toString(), pdfBuffer });
      } catch (emailError) {
        console.error("Previous trip report email failed:", emailError);
      }
    }

    const trip = await Trip.create({
      vehicleId,
      customerId: vehicle.customerId,
      driverId,
      driverAdvance,
      loadingLocation,
      loadingExpense: loadingExpense || 0,
      dieselFills: firstDieselFill
        ? [{ ...firstDieselFill, value: firstDieselFill.volume * firstDieselFill.rate }]
        : [],
      status: "open",
    });

    return res.status(201).json(trip);
  }

  if (req.method === "GET") {
    const { vehicleId, status } = req.query;
    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;

    // Non-superadmins are scoped automatically
    if (session.user.role === "admin") filter.customerId = session.user.customerId;
    if (session.user.role === "user") filter.vehicleId = session.user.assignedVehicle;
    if (session.user.role === "driver") filter.customerId = session.user.customerId;

    const trips = await Trip.find(filter).populate("driverId", "name mobileNumber licenseNumber").sort({ createdAt: -1 });
    return res.status(200).json(trips);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
