const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const RefreshSession = require("../models/RefreshSession");
const AppError = require("../utils/AppError");
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
} = require("../utils/tokens");
const { setRefreshCookie, clearRefreshCookie, setShortCookie, clearShortCookie } = require("../utils/cookies");
const { buildAuthUrl, exchangeCode, verifyGoogleIdToken } = require("../utils/google");

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  profileImage: user.profileImage,
});

/** Create a refresh session + set cookie. Returns raw token (to set cookie only). */
const issueRefreshSession = async (req, res, userId) => {
  const raw = generateRefreshToken();
  await RefreshSession.create({
    userId,
    tokenHash: hashRefreshToken(raw),
    familyId: crypto.randomUUID(),
    expiresAt: refreshExpiryDate(),
    userAgent: (req.headers["user-agent"] || "").slice(0, 300),
    ip: req.ip,
  });
  setRefreshCookie(res, raw);
};

/**
 * Generate a unique username from a display name.
 * e.g. "John Doe" → "john_doe_a3f2"
 */
const generateUsername = async (name) => {
  const base = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const suffix = crypto.randomBytes(2).toString("hex"); // 4 hex chars
  let candidate = `${base}_${suffix}`;

  // Ensure uniqueness (extremely unlikely to collide, but safe)
  let existing = await User.findOne({ username: candidate });
  while (existing) {
    const s = crypto.randomBytes(2).toString("hex");
    candidate = `${base}_${s}`;
    existing = await User.findOne({ username: candidate });
  }

  return candidate;
};

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/register
 * @desc    Create a new user account
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return next(new AppError("Please provide name, email, and password.", 400));
    }
    if (password.length < 6 || password.length > 72) {
      return next(new AppError("Password must be between 6 and 72 characters.", 400));
    }

    // 2. Reject if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError("An account with that email already exists.", 400));
    }

    // 3. Hash the password before persisting (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Auto-generate a username from the display name
    const username = await generateUsername(name);

    // 5. Create and save the new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      username,
      authProvider: "local",
    });

    // 6. Issue session: short-lived access token + rotating refresh cookie
    const accessToken = generateAccessToken(user._id);
    await issueRefreshSession(req, res, user._id);

    res.status(201).json({
      accessToken,
      token: accessToken, // legacy compat
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate a user and return a token
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return next(new AppError("Please provide email and password.", 400));
    }

    // 2. Look up the user (password excluded by default via toJSON — fetch it explicitly)
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !user.password) {
      // Use a generic message to avoid revealing whether the email exists
      return next(new AppError("Invalid email or password.", 401));
    }

    // 3. Compare supplied password against the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AppError("Invalid email or password.", 401));
    }

    // 4. Issue session
    const accessToken = generateAccessToken(user._id);
    await issueRefreshSession(req, res, user._id);

    res.status(200).json({
      accessToken,
      token: accessToken, // legacy compat
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh ────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/refresh
 * @desc    Rotate the refresh token and issue a new access token
 * @access  Public (refresh cookie)
 */
const refreshSession = async (req, res, next) => {
  try {
    // NOTE: expected auth failures here respond directly (not via next(err))
    // so routine logged-out page loads don't spam the server error log.
    const raw = req.cookies ? req.cookies.learnr_rt : null;
    if (!raw) return res.status(401).json({ success: false, message: "No refresh token provided." });
    const presentedHash = hashRefreshToken(raw);
    const now = new Date();

    // 1. Locate the live session for this token.
    const session = await RefreshSession.findOne({ tokenHash: presentedHash });

    // 2. Reuse detection: token was already rotated (found as replacedByHash).
    if (!session) {
      const reused = await RefreshSession.findOne({ replacedByHash: presentedHash });
      if (reused) {
        // Compromise suspected — revoke the entire token family.
        await RefreshSession.updateMany(
          { familyId: reused.familyId, revokedAt: null },
          { $set: { revokedAt: now } }
        );
      }
      return res.status(401).json({ success: false, message: "Invalid refresh token." });
    }

    if (session.revokedAt || session.expiresAt <= now) {
      return res.status(401).json({ success: false, message: "Refresh token expired or revoked." });
    }

    // 3. Atomic rotation: claim this token exactly once.
    const nextRaw = generateRefreshToken();
    const nextHash = hashRefreshToken(nextRaw);
    const claimed = await RefreshSession.findOneAndUpdate(
      { _id: session._id, tokenHash: presentedHash, revokedAt: null },
      {
        $set: {
          revokedAt: now,
          replacedByHash: nextHash,
        },
      },
      { new: false }
    );
    if (!claimed) {
      // Lost a concurrent rotation race — treat as reuse against the winner.
      const winner = await RefreshSession.findOne({ replacedByHash: presentedHash });
      if (winner) {
        await RefreshSession.updateMany(
          { familyId: winner.familyId, revokedAt: null },
          { $set: { revokedAt: now } }
        );
      }
      return res.status(401).json({ success: false, message: "Invalid refresh token." });
    }

    // 4. Persist the replacement session in the same family.
    await RefreshSession.create({
      userId: session.userId,
      tokenHash: nextHash,
      familyId: session.familyId,
      expiresAt: refreshExpiryDate(),
      userAgent: (req.headers["user-agent"] || "").slice(0, 300),
      ip: req.ip,
    });

    const user = await User.findById(session.userId);
    if (!user) return next(new AppError("User not found.", 401));

    const accessToken = generateAccessToken(user._id);
    setRefreshCookie(res, nextRaw);
    res.status(200).json({
      accessToken,
      token: accessToken, // legacy compat
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ─────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke the current refresh session and clear the cookie
 * @access  Public (idempotent; uses refresh cookie when present)
 */
const logoutUser = async (req, res, next) => {
  try {
    const raw = req.cookies ? req.cookies.learnr_rt : null;
    if (raw) {
      const h = hashRefreshToken(raw);
      await RefreshSession.updateMany(
        { tokenHash: h, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: "Logged out." });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/auth/logout-all
 * @desc    Revoke all refresh sessions for the authenticated user
 * @access  Protected
 */
const logoutAll = async (req, res, next) => {
  try {
    await RefreshSession.updateMany(
      { userId: req.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: "Logged out from all devices." });
  } catch (err) {
    next(err);
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/auth/me
 * @desc    Return the currently authenticated user's profile
 * @access  Protected (requires valid JWT)
 */
const getMe = async (req, res, next) => {
  try {
    // req.userId is attached by the protect middleware
    const user = await User.findById(req.userId);

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// ─── Google OAuth (Authorization Code + OIDC) ────────────────────────────────

const frontendBase = () =>
  (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");

const googleStart = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: "Google sign-in is not configured." });
  }
  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  setShortCookie(res, "g_state", state, 5 * 60 * 1000);
  setShortCookie(res, "g_nonce", nonce, 5 * 60 * 1000);
  // Remember which frontend origin started the flow (port 3000 vs 5173,
  // dev vs prod) so the callback redirects back to the right place.
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  let returnTo = frontendBase();
  const candidate = origin || (referer && (() => { try { return new URL(referer).origin; } catch (_) { return null; } })());
  if (candidate) {
    const allowed = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173")
      .split(",").map((s) => s.trim().replace(/\/$/, ""));
    if (allowed.includes(String(candidate).replace(/\/$/, ""))) returnTo = String(candidate).replace(/\/$/, "");
  }
  setShortCookie(res, "g_return", returnTo, 5 * 60 * 1000);
  return res.redirect(buildAuthUrl({ state, nonce }));
};

const googleCallback = async (req, res, next) => {
  const returnTo = (req.cookies && req.cookies.g_return) || frontendBase();
  const base = String(returnTo).replace(/\/$/, "");
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${base}/login?oauth_error=${encodeURIComponent(error)}`);
    const expectedState = req.cookies ? req.cookies.g_state : null;
    const nonce = req.cookies ? req.cookies.g_nonce : null;
    clearShortCookie(res, "g_state");
    clearShortCookie(res, "g_nonce");
    clearShortCookie(res, "g_return");
    if (!state || !expectedState || state !== expectedState) {
      return res.redirect(`${base}/login?oauth_error=invalid_state`);
    }
    if (!code) return res.redirect(`${base}/login?oauth_error=missing_code`);

    let tokens;
    try {
      tokens = await exchangeCode(String(code));
    } catch (e) {
      console.error(`[Google OAuth] token exchange failed: ${e.message}`);
      return res.redirect(`${base}/login?oauth_error=exchange_failed`);
    }
    if (!tokens.id_token) return res.redirect(`${base}/login?oauth_error=invalid_token`);
    let claims;
    try {
      claims = await verifyGoogleIdToken(tokens.id_token, nonce || undefined);
    } catch (e) {
      console.error(`[Google OAuth] ID token verification failed: ${e.message}`);
      return res.redirect(`${base}/login?oauth_error=invalid_token`);
    }

    if (!claims.email_verified) {
      return res.redirect(`${base}/login?oauth_error=email_not_verified`);
    }
    const googleId = String(claims.sub);
    const email = String(claims.email).toLowerCase();

    // 1. Existing linked account — log in.
    let user = await User.findOne({ googleId });
    if (!user) {
      // 2. No silent takeover: an email match alone never links.
      // Safe exception: the browser already holds a valid Learnr session
      // for that same email user (i.e. they signed in with password first
      // and are explicitly linking from Profile). Then linking is explicit.
      const byEmail = await User.findOne({ email });
      if (byEmail) {
        let linked = false;
        try {
          const rtRaw = req.cookies ? req.cookies.learnr_rt : null;
          if (rtRaw) {
            const sess = await RefreshSession.findOne({
              tokenHash: hashRefreshToken(rtRaw),
              revokedAt: null,
            });
            if (sess && String(sess.userId) === String(byEmail._id) && sess.expiresAt > new Date()) {
              byEmail.googleId = googleId;
              byEmail.authProvider = byEmail.password ? "both" : "google";
              await byEmail.save();
              user = byEmail;
              linked = true;
            }
          }
        } catch (_) {}
        if (!linked) {
          // If the email account already linked this googleId it would have matched above.
          return res.redirect(`${base}/login?oauth_error=account_exists`);
        }
      } else {
        const username = await generateUsername(claims.name || email.split("@")[0]);
        const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
        try {
          user = await User.create({
            name: claims.name || email.split("@")[0],
            email,
            username,
            password: randomPw,
            googleId,
            authProvider: "google",
            profileImage: claims.picture || "",
          });
        } catch (e) {
          // Concurrent callbacks — re-read instead of duplicating.
          if (e.code === 11000) {
            user = (await User.findOne({ googleId })) || (await User.findOne({ email }));
          } else throw e;
        }
      }
    } else if (!user.email) {
      user.email = email;
      await user.save().catch(() => {});
    }

    if (!user) return res.redirect(`${base}/login?oauth_error=account_error`);
    const accessToken = generateAccessToken(user._id);
    await issueRefreshSession(req, res, user._id);
    return res.redirect(`${base}/oauth/callback?success=1`);
  } catch (err) {
    console.error(`[Google OAuth] callback failed: ${err.message}`);
    const fallback = (req.cookies && req.cookies.g_return) || frontendBase();
    return res.redirect(`${String(fallback).replace(/\/$/, "")}/login?oauth_error=auth_failed`);
  }
};

module.exports = { registerUser, loginUser, refreshSession, logoutUser, logoutAll, getMe, googleStart, googleCallback };
