const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
const ISS = process.env.JWT_ISSUER || undefined;
const AUD = process.env.JWT_AUDIENCE || undefined;

/**
 * Short-lived access token. Minimum claims: sub, iat, exp, jti.
 * Backwards compatible: also includes legacy `userId` claim.
 */
const generateAccessToken = (userId) => {
  const payload = {
    sub: String(userId),
    userId: String(userId), // legacy compat for old middleware/clients
  };
  const opts = {
    expiresIn: ACCESS_EXPIRES,
    algorithm: "HS256",
    jwtid: crypto.randomUUID(),
  };
  if (ISS) opts.issuer = ISS;
  if (AUD) opts.audience = AUD;
  return jwt.sign(payload, process.env.JWT_SECRET, opts);
};

/** Verify access token with explicit algorithm + optional iss/aud. */
const verifyAccessToken = (token) => {
  const opts = { algorithms: ["HS256"] };
  if (ISS) opts.issuer = ISS;
  if (AUD) opts.audience = AUD;
  return jwt.verify(token, process.env.JWT_SECRET, opts);
};

/** Cryptographically secure opaque refresh token (256 bits, base64url). */
const generateRefreshToken = () => crypto.randomBytes(32).toString("base64url");

/** SHA-256 hash for storage/comparison. Never store raw tokens. */
const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

const refreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

const refreshMaxAgeSec = () => REFRESH_DAYS * 24 * 60 * 60;

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  refreshMaxAgeSec,
  ACCESS_EXPIRES,
  REFRESH_DAYS,
};
