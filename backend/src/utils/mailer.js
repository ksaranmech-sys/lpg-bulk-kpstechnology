const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendEmail({ to, cc, subject, html, attachments = [] }) {
  const t = getTransporter();
  return t.sendMail({
    from: process.env.MAIL_FROM,
    to,
    cc,
    subject,
    html,
    attachments,
  });
}

/**
 * Sends the trip settlement PDF to the company mailbox (and optionally the
 * customer's own email, cc'd) as an attachment.
 */
async function sendTripSettlementEmail({ to, cc, subject, html, pdfBuffer, pdfFilename }) {
  return sendEmail({
    to,
    cc,
    subject,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

async function sendVehicleReminderEmail({ vehicleNumber, documentLabel, expiryDate, to, cc }) {
  const subject = `Vehicle reminder: ${documentLabel} for ${vehicleNumber}`;
  const html = `
    <p>This is a reminder that the <strong>${documentLabel}</strong> for vehicle <strong>${vehicleNumber}</strong> expires on <strong>${new Date(expiryDate).toLocaleDateString('en-IN')}</strong>.</p>
    <p>Please renew it before the due date.</p>
  `;
  return sendEmail({ to, cc, subject, html });
}

async function sendPasswordResetCodeEmail({ to, name, code, minutesValid }) {
  const subject = 'KPS Fleet password reset code';
  const html = `
    <p>Hello ${name || ''},</p>
    <p>Your password reset code is:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
    <p>It is valid for ${minutesValid} minutes. If you did not request a reset, ignore this email - your password has not changed.</p>
  `;
  return sendEmail({ to, subject, html });
}

module.exports = { sendTripSettlementEmail, sendVehicleReminderEmail, sendPasswordResetCodeEmail };
