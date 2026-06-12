const mongoose = require("mongoose");

/**
 * Goal Model
 * Stores daily and weekly goals with embedded tasks.
 * Replaces the previous localStorage-only approach so that
 * historical goal data is persisted and queryable.
 *
 * Each document represents one goal entry for a specific user,
 * date, and type (daily or weekly).
 *
 * Relationships:
 *   Many Goals → One User (via userId)
 */

const taskSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Task text is required"],
      trim: true,
      maxlength: [200, "Task text cannot exceed 200 characters"],
    },
    done: {
      type: Boolean,
      default: false,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
  },
  { _id: true, timestamps: false }
);

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    // "daily" or "weekly"
    type: {
      type: String,
      enum: ["daily", "weekly"],
      required: [true, "Goal type is required"],
    },

    // Calendar date in YYYY-MM-DD format
    // For daily goals: the specific day
    // For weekly goals: the Monday of that week
    date: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    // The goal description text
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Goal description cannot exceed 500 characters"],
    },

    // Embedded tasks
    tasks: [taskSchema],

    // Whether ALL tasks in this goal have been completed
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One goal per user per date per type
goalSchema.index({ userId: 1, date: 1, type: 1 }, { unique: true });
// For history queries — sorted by date descending
goalSchema.index({ userId: 1, type: 1, date: -1 });

module.exports = mongoose.model("Goal", goalSchema);
