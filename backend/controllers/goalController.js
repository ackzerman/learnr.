const Goal = require("../models/Goal");
const GoalCompletion = require("../models/GoalCompletion");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getTodayString } = require("../utils/dateHelpers");

// ─── Get Today's Goal ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/goals/today
 * @desc    Get or create today's daily goal for the current user.
 * @access  Protected
 */
const getToday = async (req, res, next) => {
  try {
    const userId = req.userId;
    const today = getTodayString();

    let goal = await Goal.findOne({ userId, date: today, type: "daily" });

    if (!goal) {
      goal = await Goal.create({
        userId,
        date: today,
        type: "daily",
        description: "",
        tasks: [],
      });
    }

    res.status(200).json({ goal });
  } catch (err) {
    next(err);
  }
};

// ─── Save / Update Goal ──────────────────────────────────────────────────────

/**
 * @route   POST /api/goals
 * @desc    Create or update a goal (daily or weekly) for a specific date.
 * @body    { type: "daily"|"weekly", date?: "YYYY-MM-DD", description: string }
 * @access  Protected
 */
const saveGoal = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { type, description } = req.body;
    const date = req.body.date || getTodayString();

    if (!type || !["daily", "weekly"].includes(type)) {
      return next(new AppError("Type must be 'daily' or 'weekly'.", 400));
    }

    const safeDesc = typeof description === "string"
      ? description.trim().slice(0, 500)
      : "";

    const goal = await Goal.findOneAndUpdate(
      { userId, date, type },
      { $set: { description: safeDesc } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ goal });
  } catch (err) {
    next(err);
  }
};

// ─── Add Task ─────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/goals/tasks
 * @desc    Add a task to today's daily goal.
 * @body    { text: string }
 * @access  Protected
 */
const addTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const today = getTodayString();
    const { text, videoId, courseId } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return next(new AppError("Task text is required.", 400));
    }

    const safeText = text.trim().slice(0, 200);

    // Find or create today's daily goal
    let goal = await Goal.findOne({ userId, date: today, type: "daily" });
    if (!goal) {
      goal = await Goal.create({
        userId,
        date: today,
        type: "daily",
        description: "",
        tasks: [],
      });
    }

    if (goal.tasks.length >= 20) {
      return next(new AppError("Maximum 20 tasks per day.", 400));
    }

    const newTask = { text: safeText, done: false };
    if (videoId && courseId) {
      newTask.videoId = videoId;
      newTask.courseId = courseId;
    }

    goal.tasks.push(newTask);
    goal.completed = false;
    await goal.save();

    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle Task ──────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/goals/tasks/:taskId
 * @desc    Toggle a task's done status. If all tasks become done,
 *          marks the goal as completed and records a GoalCompletion
 *          for streak tracking.
 * @access  Protected
 */
const toggleTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { taskId } = req.params;
    const today = getTodayString();

    const goal = await Goal.findOne({ userId, date: today, type: "daily" });
    if (!goal) {
      return next(new AppError("No goal found for today.", 404));
    }

    const task = goal.tasks.id(taskId);
    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    task.done = !task.done;

    // Check if ALL tasks are now done
    const allDone = goal.tasks.length > 0 && goal.tasks.every((t) => t.done);
    goal.completed = allDone;
    await goal.save();

    // If all tasks just became done, record a GoalCompletion for streak
    if (allDone) {
      await GoalCompletion.findOneAndUpdate(
        { userId, date: today },
        { userId, date: today },
        { upsert: true }
      );

      // Recalculate streak from GoalCompletion records
      await _recalculateStreak(userId);
    }

    res.status(200).json({ goal, allCompleted: allDone });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Task ──────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/goals/tasks/:taskId
 * @desc    Remove a task from today's daily goal.
 * @access  Protected
 */
const deleteTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { taskId } = req.params;
    const today = getTodayString();

    const goal = await Goal.findOne({ userId, date: today, type: "daily" });
    if (!goal) {
      return next(new AppError("No goal found for today.", 404));
    }

    const task = goal.tasks.id(taskId);
    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    task.deleteOne();

    // Recalculate completion status
    const allDone = goal.tasks.length > 0 && goal.tasks.every((t) => t.done);
    goal.completed = allDone;
    await goal.save();

    res.status(200).json({ goal });
  } catch (err) {
    next(err);
  }
};

// ─── Goal History ─────────────────────────────────────────────────────────────

/**
 * @route   GET /api/goals/history?type=daily&page=1
 * @desc    Paginated history of past goals by type.
 * @access  Protected
 */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const type = req.query.type || "daily";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 15;
    const skip = (page - 1) * limit;

    if (!["daily", "weekly"].includes(type)) {
      return next(new AppError("Type must be 'daily' or 'weekly'.", 400));
    }

    const [total, goals] = await Promise.all([
      Goal.countDocuments({ userId, type }),
      Goal.find({ userId, type })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      goals,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helper: Recalculate Streak ───────────────────────────────────────────────

/**
 * Walks backwards from today through consecutive GoalCompletion records
 * to compute the current streak. Updates the User document.
 *
 * @param {string} userId
 */
const _recalculateStreak = async (userId) => {
  // Get all completions sorted by date descending
  const completions = await GoalCompletion.find({ userId })
    .sort({ date: -1 })
    .limit(365)
    .select("date")
    .lean();

  if (completions.length === 0) {
    await User.findByIdAndUpdate(userId, { streak: 0, lastActiveDate: new Date() });
    return;
  }

  const completedDates = new Set(completions.map((c) => c.date));
  const today = getTodayString();

  // Start counting from today or yesterday
  let streak = 0;
  let checkDate = new Date();

  // If today isn't completed, check if yesterday started a streak
  if (!completedDates.has(today)) {
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  // Walk backwards counting consecutive completed days
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (completedDates.has(dateStr)) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  const user = await User.findById(userId);
  user.streak = streak;
  user.lastActiveDate = new Date();
  if (streak > (user.maxStreak ?? 0)) {
    user.maxStreak = streak;
  }
  await user.save();
};

module.exports = { getToday, saveGoal, addTask, toggleTask, deleteTask, getHistory };
