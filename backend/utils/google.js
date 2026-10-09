const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let cachedCerts = null;
let certsFetchedAt = 0;

const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID;
const getRedirectUri = () =>
  process.env.GOOGLE_CALLBACK_URL ||
  `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`}/api/auth/google/callback`;

const buildAuthUrl = ({ state, nonce }) => {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeCode = async (code) => {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error_description || data.error || "Google token exchange failed.");
    err.statusCode = 401;
    throw err;
  }
  return data; // { id_token, access_token, ... }
};

const getCerts = async () => {
  if (cachedCerts && Date.now() - certsFetchedAt < 60 * 60 * 1000) return cachedCerts;
  const r = await fetch(GOOGLE_CERTS_URL);
  if (!r.ok) throw Object.assign(new Error("Failed to fetch Google certs."), { statusCode: 502 });
  const data = await r.json();
  cachedCerts = data.keys || [];
  certsFetchedAt = Date.now();
  return cachedCerts;
};

const pemFromJwk = (jwk) => {
  // Convert JWK (n, e) to PEM using Node crypto JWK support.
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  return key.export({ format: "pem", type: "spki" });
};

/**
 * Validate a Google ID token: signature (RS256 via Google JWKS),
 * issuer, audience, expiry, and nonce (when expectedNonce supplied).
 * Returns the verified claims (sub, email, email_verified, name, picture).
 */
const verifyGoogleIdToken = async (idToken, expectedNonce) => {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw Object.assign(new Error("Invalid Google ID token."), { statusCode: 401 });
  }
  const { kid, alg } = decoded.header;
  if (alg !== "RS256" || !kid) {
    throw Object.assign(new Error("Invalid Google ID token."), { statusCode: 401 });
  }
  const keys = await getCerts();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) throw Object.assign(new Error("Unknown Google signing key."), { statusCode: 401 });
  let claims;
  try {
    claims = jwt.verify(idToken, pemFromJwk(jwk), {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: getGoogleClientId(),
    });
  } catch (e) {
    throw Object.assign(new Error("Invalid Google ID token."), { statusCode: 401 });
  }
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw Object.assign(new Error("Invalid Google ID token (nonce mismatch)."), { statusCode: 401 });
  }
  return claims;
};

/** Pure claim checks (unit-testable without network). */
const validateIdTokenClaims = (claims, { audience, expectedNonce, nowSec = Math.floor(Date.now() / 1000) }) => {
  if (!claims || typeof claims !== "object") return "Invalid claims.";
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issOk) return "Invalid issuer.";
  if (claims.aud !== audience) return "Invalid audience.";
  if (typeof claims.exp !== "number" || claims.exp <= nowSec) return "Token expired.";
  if (expectedNonce && claims.nonce !== expectedNonce) return "Invalid nonce.";
  if (!claims.sub) return "Missing sub.";
  return null;
};

module.exports = {
  buildAuthUrl,
  exchangeCode,
  verifyGoogleIdToken,
  validateIdTokenClaims,
  getRedirectUri,
  // test seam
  __setCertsCache: (keys) => { cachedCerts = keys; certsFetchedAt = Date.now(); },
};
