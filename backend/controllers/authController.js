const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const AppError = require("../utils/AppError");

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
    });

    // 6. Issue a JWT for the new user
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
      },
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
    if (!user) {
      // Use a generic message to avoid revealing whether the email exists
      return next(new AppError("Invalid email or password.", 401));
    }

    // 3. Compare supplied password against the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AppError("Invalid email or password.", 401));
    }

    // 4. Issue a JWT
    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
      },
    });
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

module.exports = { registerUser, loginUser, getMe };
