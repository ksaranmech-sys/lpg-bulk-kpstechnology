// Checks the SMTP settings in backend/.env and optionally sends a test email.
//   npm run mail:check                      -> verifies login only
//   npm run mail:check -- you@example.com   -> verifies login and sends a test message
require('../config/env');
const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

async function main() {
  console.log(`SMTP ${SMTP_USER || '<no user>'} @ ${SMTP_HOST || '<no host>'}:${SMTP_PORT || 587} (secure=${SMTP_SECURE === 'true'})`);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.verify();
    console.log('Login OK.');
  } catch (err) {
    console.error(`Login FAILED: ${(err.response || err.message || '').split('\n')[0]}`);
    if (/gmail/i.test(SMTP_HOST || '')) {
      console.error('Gmail needs an App Password (Google Account > Security > 2-Step Verification > App passwords), not the normal password.');
    }
    process.exit(1);
  }

  const to = process.argv[2];
  if (!to) return;
  await transporter.sendMail({ from: MAIL_FROM, to, subject: 'KPS Fleet mail check', text: 'If you can read this, SMTP is configured correctly.' });
  console.log(`Test email sent to ${to}.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
