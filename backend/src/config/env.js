// Single place that reads and validates environment variables. Everything else imports from
// here instead of touching process.env directly, so a missing secret fails loudly at startup
// rather than silently falling back to an insecure default.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function requireSecret(name, { minLength = 32 } = {}) {
  const value = process.env[name];
  if (!value || value.length < minLength || /change_this|change_me/i.test(value)) {
    throw new Error(
      `[config] ${name} must be set to a random string of at least ${minLength} characters. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return value;
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  isProduction,
  isTest,
  port: Number(process.env.PORT || 5001),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
  // Public URL of the website, used in emailed links (e.g. password reset). Falls back to the
  // first allowed browser origin, then the API URL (which serves the frontend build in production).
  appBaseUrl: (process.env.APP_BASE_URL || parseList(process.env.ALLOWED_ORIGINS)[0] || process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  mongoUri: process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || '',
  jwt: {
    secret: requireSecret('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  // Comma-separated list of browser origins allowed to call the API. Native mobile apps send no
  // Origin header and are always allowed. Empty list = allow all (dev only; warns in production).
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
  autoSeed: process.env.AUTO_SEED !== 'false',
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    cloudinaryUrl: process.env.CLOUDINARY_URL || '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'kps-fleet',
  },
};

if (config.jwt.secret === config.jwt.refreshSecret) {
  throw new Error('[config] JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
}

// Mail is needed for password-reset links and trip settlement reports. Placeholder values copied
// from .env.example are rejected by the SMTP server with "535 Username and Password not accepted".
const smtpLooksUnconfigured = !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS
  || /your_smtp|example\.com|change_me|change_this/i.test(`${process.env.SMTP_USER} ${process.env.SMTP_PASS}`);
if (smtpLooksUnconfigured && !isTest) {
  console.warn('[config] SMTP_USER / SMTP_PASS are missing or still placeholders - emails (password reset links, settlement reports) will fail. '
    + 'Set real SMTP credentials in backend/.env and run "npm run mail:check".');
}

if (isProduction) {
  if (!config.mongoUri) throw new Error('[config] MONGO_URI is required in production.');
  if (!config.allowedOrigins.length) {
    console.warn('[config] ALLOWED_ORIGINS is not set - any website can call this API. Set it on your host (e.g. Render).');
  }
  if (config.storage.driver === 'local') {
    console.warn('[config] STORAGE_DRIVER=local in production - uploaded photos will be lost on every redeploy. Use "cloudinary".');
  }
}

module.exports = config;
