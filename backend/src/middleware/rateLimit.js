const rateLimit = require('express-rate-limit');

const jsonHandler = (message) => (req, res) => res.status(429).json({ error: message });

// Brute-force protection for credential endpoints: 10 attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonHandler('Too many login attempts. Please wait 15 minutes and try again.'),
});

// Generous ceiling for everything else - stops runaway scripts without affecting normal use.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many requests. Please slow down and try again shortly.'),
});

module.exports = { loginLimiter, apiLimiter };
