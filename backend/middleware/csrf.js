const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * Origin/Referer validation for cookie-authenticated POST endpoints
 * (refresh, logout). CORS alone does not prevent CSRF.
 * Allows requests with no Origin/Referer (curl, mobile, tests).
 */
const allowedOrigins = () =>
  (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

const csrfCheck = (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowed = allowedOrigins();
  const norm = (u) => String(u).replace(/\/$/, "");
  if (origin && !allowed.map(norm).includes(norm(origin))) {
    return res.status(403).json({ success: false, message: "Invalid origin." });
  }
  if (!origin && referer) {
    try {
      const r = new URL(referer);
      if (!allowed.map(norm).includes(norm(r.origin))) {
        return res.status(403).json({ success: false, message: "Invalid referer." });
      }
    } catch (_) {
      return res.status(403).json({ success: false, message: "Invalid referer." });
    }
  }
  return next();
};

module.exports = { csrfCheck, allowedOrigins };
