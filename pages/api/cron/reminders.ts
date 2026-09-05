// @ts-nocheck
import { dbConnect } from "../../../lib/mongodb";
import Vehicle from "../../../models/Vehicle";
import Customer from "../../../models/Customer";
import { shouldRemind, docLabel, DOCUMENT_FIELDS } from "../../../lib/reminders";
import { sendReminderEmail } from "../../../lib/email";

// Triggered daily by Vercel Cron (see vercel.json). Protect it with CRON_SECRET so
// it can't be hit publicly - Vercel automatically sends this header for cron calls
// when CRON_SECRET is set as an env var.
export default async function handler(req, res) {
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await dbConnect();
  const today = new Date();
  const vehicles = await Vehicle.find({});
  let sent = 0;

  for (const vehicle of vehicles) {
    const customer = await Customer.findById(vehicle.customerId);
    if (!customer) continue;

    for (const field of DOCUMENT_FIELDS) {
      const entry = vehicle.documents?.[field];
      const dedupeKey = shouldRemind(entry, today);
      if (!dedupeKey) continue;

      await sendReminderEmail({
        to: customer.email,
        vehicleNumber: vehicle.vehicleNumber,
        docLabel: docLabel(field),
        expiryDate: entry.expiryDate,
      });

      vehicle.documents[field].lastReminderSentFor = dedupeKey;
      sent++;
    }
    await vehicle.save();
  }

  return res.status(200).json({ ok: true, remindersSent: sent });
}
