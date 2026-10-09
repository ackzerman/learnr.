const mongoose = require("mongoose");

/**
 * RefreshSession Model
 * Persistent server-side record for opaque refresh tokens.
 *
 * Security notes:
 * - Only the SHA-256 hash of the refresh token is stored, never the raw token.
 * - Rotation is atomic via findOneAndUpdate on (tokenHash + revokedAt:null).
 * - `familyId` groups all rotations of one login chain so reuse of a
 *   superseded token revokes the whole family (reuse detection).
 * - TTL index on expiresAt is for eventual cleanup only; expiry/revocation
 *   are always enforced in application logic.
 */
const refreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    replacedByHash: {
      type: String,
      default: null,
      index: true,
    },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

// Eventual cleanup of long-expired documents. NOT the enforcement mechanism.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);
