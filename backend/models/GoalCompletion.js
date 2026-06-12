const mongoose = require("mongoose");

/**
 * GoalCompletion Model
 * Records each day a user completes ALL their daily goal tasks.
 * Used to compute the calendar streak — a continuous chain of
 * days where the user achieved their daily goal.
 *
 * One record per completed day per user.
 *
 * Relationships:
 *   Many GoalCompletions → One User (via userId)
 */
const goalCompletionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    // Calendar day in YYYY-MM-DD format
    date: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
  },
  {
    timestamps: true,
  }
);

// One completion record per user per calendar day
goalCompletionSchema.index({ userId: 1, date: 1 }, { unique: true });
// For streak calculations — walk backwards by date
goalCompletionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("GoalCompletion", goalCompletionSchema);
