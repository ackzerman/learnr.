const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { registerUser, loginUser, refreshSession, logoutUser, logoutAll, getMe, googleStart, googleCallback } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { csrfCheck } = require("../middleware/csrf");

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

/**
 * Auth Routes
 * Base path: /api/auth  (mounted in server.js)
 */

// @route  POST /api/auth/register — Create a new account
router.post("/register", strictLimiter, registerUser);

// @route  POST /api/auth/login    — Authenticate and receive a token
router.post("/login", strictLimiter, loginUser);

// @route  POST /api/auth/refresh  — Rotate refresh cookie, issue access token
router.post("/refresh", refreshLimiter, csrfCheck, refreshSession);

// @route  POST /api/auth/logout   — Revoke current refresh session (idempotent)
router.post("/logout", csrfCheck, logoutUser);

// @route  POST /api/auth/logout-all — Revoke all sessions for the user
router.post("/logout-all", protect, logoutAll);

// @route  GET  /api/auth/google          — Begin Google OIDC flow
router.get("/google", strictLimiter, googleStart);

// @route  GET  /api/auth/google/callback — Google redirect target
router.get("/google/callback", googleCallback);

// @route  GET  /api/auth/me       — Get current user (JWT required)
router.get("/me", protect, getMe);

module.exports = router;
