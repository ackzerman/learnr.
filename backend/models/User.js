const mongoose = require("mongoose");

/**
 * User Model
 * Core identity model for the application.
 * Stores credentials and tracks learning streak activity.
 * Passwords are stored as bcrypt hashes — never in plain text.
 *
 * Relationships:
 *   One User → many Courses
 *   One User → many Progress records
 *   One User → many DailyActivity records
 *   One User → many Notes
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      sparse: true,        // Allows existing docs without username
      lowercase: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must be at most 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ],
    },

    profileImage: {
      type: String,
      default: "",          // Empty = use initials fallback on frontend
    },

    // Cloudinary public_id — needed to delete/replace the old image
    profileImagePublicId: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,       // Enforced at DB level
      lowercase: true,    // Normalise before saving
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      // Required for local accounts; OAuth-only accounts store an unusable random hash.
      // Required-ness is enforced in controller logic to allow Google-only users.
      required: false,
      minlength: [6, "Password must be at least 6 characters"],
    },

    // Google OIDC identity — stable `sub` claim. Never use email as the key.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "both"],
      default: "local",
    },

    // Highest all-time video-watching activity streak — only increases.
    // Current activity streak is computed on the fly from DailyActivity records.
    maxActivityStreak: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

/**
 * Exclude the password field whenever a User document is serialised to JSON.
 * This prevents accidental password leaks in any API response.
 */
userSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
