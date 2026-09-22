const jwt = require('jsonwebtoken');
const config = require('../config/env');

const PDF_TOKEN_SCOPE = 'monthly-summary';

// Short-lived token sent as "Authorization: Bearer ..." on every API request.
function signAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, customer: user.customer, vehicle: user.vehicle },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// Long-lived token used only to obtain a new access token. `tv` (tokenVersion) lets us revoke
// every refresh token for a user at once (logout everywhere / password change).
function signRefreshToken(user) {
  return jwt.sign(
    { id: user._id, type: 'refresh', tv: user.tokenVersion || 0 },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  if (payload.type !== 'refresh') throw new Error('Not a refresh token');
  return payload;
}

// Scoped token for opening a PDF directly in a browser tab (no Authorization header possible).
function signPdfToken(user, { customerId, userId, month, which }) {
  return jwt.sign(
    { id: user.id, role: user.role, customer: user.customer, scope: PDF_TOKEN_SCOPE, customerId, userId, month, which },
    config.jwt.secret,
    { expiresIn: '2m' }
  );
}

module.exports = {
  PDF_TOKEN_SCOPE,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signPdfToken,
};
