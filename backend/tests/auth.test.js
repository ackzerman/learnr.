const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_for_unit_tests_only_0123456789";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";

const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require("../utils/tokens");
const { validateIdTokenClaims } = require("../utils/google");
const { csrfCheck } = require("../middleware/csrf");
const cookies = require("../utils/cookies");

describe("access tokens", () => {
  it("issues verifiable token with sub claim and short expiry", () => {
    const t = generateAccessToken("user123");
    const d = verifyAccessToken(t);
    assert.equal(d.sub, "user123");
    assert.equal(d.userId, "user123"); // legacy compat
    assert.ok(d.jti);
    assert.ok(d.exp - d.iat <= 15 * 60 + 5);
  });

  it("rejects tampered signatures", () => {
    const t = generateAccessToken("u1");
    assert.throws(() => verifyAccessToken(t + "x"));
  });

  it("rejects tokens signed with wrong secret", () => {
    const jwt = require("jsonwebtoken");
    const bad = jwt.sign({ sub: "u1" }, "wrong-secret", { expiresIn: "15m", algorithm: "HS256" });
    assert.throws(() => verifyAccessToken(bad));
  });

  it("rejects expired tokens", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign({ sub: "u1" }, process.env.JWT_SECRET, { expiresIn: "-10s", algorithm: "HS256" });
    assert.throws(() => verifyAccessToken(expired));
  });
});

describe("refresh tokens", () => {
  it("generates unique high-entropy tokens and stable hashes", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 43);
    assert.equal(hashRefreshToken(a), hashRefreshToken(a));
    assert.notEqual(hashRefreshToken(a), hashRefreshToken(b));
  });
});

describe("Google ID-token claim validation", () => {
  const base = {
    iss: "https://accounts.google.com",
    aud: "test-client.apps.googleusercontent.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: "google-sub-1",
    nonce: "n1",
  };
  it("accepts valid claims", () => {
    assert.equal(validateIdTokenClaims(base, { audience: base.aud, expectedNonce: "n1" }), null);
  });
  it("rejects wrong audience", () => {
    assert.ok(validateIdTokenClaims(base, { audience: "other" }));
  });
  it("rejects expired tokens", () => {
    assert.ok(validateIdTokenClaims({ ...base, exp: 1 }, { audience: base.aud }));
  });
  it("rejects wrong issuer", () => {
    assert.ok(validateIdTokenClaims({ ...base, iss: "https://evil.com" }, { audience: base.aud }));
  });
  it("rejects nonce mismatch", () => {
    assert.ok(validateIdTokenClaims(base, { audience: base.aud, expectedNonce: "other" }));
  });
  it("rejects missing sub", () => {
    const { sub, ...rest } = base;
    assert.ok(validateIdTokenClaims(rest, { audience: base.aud }));
  });
});

describe("CSRF origin check", () => {
  const run = (headers) =>
    new Promise((resolve) => {
      const req = { headers };
      const res = { status: (c) => ({ json: (b) => resolve({ c, b }) }) };
      csrfCheck(req, res, () => resolve({ c: 200 }));
    });
  it("allows missing origin (curl/tests)", async () => {
    assert.equal((await run({})).c, 200);
  });
  it("rejects cross-origin", async () => {
    assert.equal((await run({ origin: "https://evil.com" })).c, 403);
  });
});

describe("refresh cookie helpers", () => {
  const mockRes = () => {
    const calls = [];
    return {
      calls,
      cookie: function (n, v, o) { calls.push(["set", n, v, o]); },
      clearCookie: function (n, o) { calls.push(["clear", n, o]); },
    };
  };
  it("sets HttpOnly cookie and clears with matching path", () => {
    const res = mockRes();
    cookies.setRefreshCookie(res, "tok");
    const set = res.calls[0];
    assert.equal(set[1], "learnr_rt");
    assert.equal(set[3].httpOnly, true);
    assert.equal(set[3].path, "/api/auth");
    const res2 = mockRes();
    cookies.clearRefreshCookie(res2);
    assert.equal(res2.calls[0][0], "clear");
    assert.equal(res2.calls[0][1], "learnr_rt");
    assert.equal(res2.calls[0][2].path, "/api/auth");
  });
  it("never puts refresh token in response body (controller contract)", async () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "../controllers/authController.js"), "utf8");
    // No res.json containing a raw refresh token variable.
    assert.ok(!/res\.json\([^)]*refreshToken[^)]*\)/.test(src));
  });
});
