// @ts-nocheck
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTripReport({ to, vehicleNumber, tripId, pdfBuffer }) {
  return resend.emails.send({
    from: "KPS Technology Fleet <fleet@kpstechnology.com>", // must be a domain verified in Resend
    to,
    subject: `Trip Settlement Report - ${vehicleNumber} - ${tripId}`,
    html: `<p>Please find attached the settlement report for vehicle <b>${vehicleNumber}</b>.</p>`,
    attachments: [{ filename: `trip-${tripId}.pdf`, content: pdfBuffer.toString("base64") }],
  });
}

export async function sendReminderEmail({ to, vehicleNumber, docLabel, expiryDate }) {
  return resend.emails.send({
    from: "KPS Technology Fleet <fleet@kpstechnology.com>",
    to,
    subject: `Reminder: ${docLabel} expiring for ${vehicleNumber}`,
    html: `<p>The <b>${docLabel}</b> for vehicle <b>${vehicleNumber}</b> is due on <b>${new Date(
      expiryDate
    ).toDateString()}</b>. Please renew in time.</p>`,
  });
}
