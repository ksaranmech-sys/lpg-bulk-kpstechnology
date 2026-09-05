/* =========================================================================
   LICENSE.JS
   A lightweight, offline license-key scheme for a single-tenant, per-
   customer deployment. There is no server: the key is checked entirely in
   the browser against COMPANY_ID from config.js. This is good enough to
   enforce an annual renewal conversation with each customer, but it is NOT
   tamper-proof — anyone who reads this file can forge keys. If that matters
   for your business, move DevKit.validate() to a small server endpoint
   instead and keep the salt off the client.
   ========================================================================= */

const LicenseKit = (() => {
  // Change this salt once, keep it private, never ship it to customers as
  // a visible string anywhere else (e.g. don't reuse it in UI copy).
  const SALT = "TRK-FLEET-2026-9f2c";

  function toBase36(num, width) {
    return num.toString(36).toUpperCase().padStart(width, "0");
  }

  // Simple deterministic 32-bit hash (djb2). Not cryptographic — fine for
  // an offline license checksum.
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  function checksumFor(companyId, expiryYYYYMMDD) {
    const h = hash(`${companyId}|${expiryYYYYMMDD}|${SALT}`);
    return toBase36(h % (36 ** 5), 5);
  }

  /** Generate a key for companyId, valid for `years` years from today (or from a given start date). */
  function generate(companyId, years = 1, startDate = new Date()) {
    const expiry = new Date(startDate);
    expiry.setFullYear(expiry.getFullYear() + years);
    const y = expiry.getFullYear();
    const m = String(expiry.getMonth() + 1).padStart(2, "0");
    const d = String(expiry.getDate()).padStart(2, "0");
    const expiryStr = `${y}${m}${d}`;
    const sum = checksumFor(companyId, expiryStr);
    const idPart = toBase36(hash(companyId) % (36 ** 4), 4);
    return {
      key: `TRK-${idPart}-${expiryStr}-${sum}`,
      expiry: `${y}-${m}-${d}`
    };
  }

  /** Validate a key string against companyId. Returns {valid, expiry, reason}. */
  function validate(keyStr, companyId) {
    if (!keyStr) return { valid: false, reason: "No key entered." };
    const parts = keyStr.trim().toUpperCase().split("-");
    if (parts.length !== 4 || parts[0] !== "TRK") {
      return { valid: false, reason: "Key format not recognized." };
    }
    const [, idPart, expiryStr, sum] = parts;
    const expectedIdPart = toBase36(hash(companyId) % (36 ** 4), 4);
    if (idPart !== expectedIdPart) {
      return { valid: false, reason: "This key was not issued for this company." };
    }
    if (!/^\d{8}$/.test(expiryStr)) {
      return { valid: false, reason: "Key format not recognized." };
    }
    const expectedSum = checksumFor(companyId, expiryStr);
    if (sum !== expectedSum) {
      return { valid: false, reason: "Key checksum does not match. Check for typos." };
    }
    const y = +expiryStr.slice(0, 4), m = +expiryStr.slice(4, 6), d = +expiryStr.slice(6, 8);
    const expiryDate = new Date(y, m - 1, d, 23, 59, 59);
    const today = new Date();
    if (today > expiryDate) {
      return { valid: false, expired: true, expiry: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, reason: "This license key has expired. Contact the developer for renewal." };
    }
    const daysLeft = Math.ceil((expiryDate - today) / 86400000);
    return { valid: true, expiry: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, daysLeft };
  }

  return { generate, validate };
})();
