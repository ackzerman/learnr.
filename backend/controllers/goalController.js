const Goal = require("../models/Goal");
const GoalCompletion = require("../models/GoalCompletion");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getTodayString, getMondayString } = require("../utils/dateHelpers");

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

// ─── Get Goal by Date ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/goals/date/:date
 * @desc    Get a goal for a specific date (YYYY-MM-DD). Does NOT create one if absent.
 * @access  Protected
 */
const getByDate = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return next(new AppError("Date must be in YYYY-MM-DD format.", 400));
    }

    const today = getTodayString();
    const isToday = date === today;

    let goal = await Goal.findOne({ userId, date, type: "daily" });

    // Only auto-create for today
    if (!goal && isToday) {
      goal = await Goal.create({
        userId,
        date: today,
        type: "daily",
        description: "",
        tasks: [],
      });
    }

    // Return null goal for past dates with no data
    res.status(200).json({ goal: goal || null, isToday });
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return next(new AppError("Date must be in YYYY-MM-DD format.", 400));
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

// ─── Helper: Sync Completion State ───────────────────────────────────────────

/**
 * Make the GoalCompletion record for a date mirror the goal's actual state,
 * then recalculate the streak. Handles both directions: records a completion
 * when all tasks are done, and removes a stale one when they no longer are
 * (task un-toggled, new task added, etc.).
 *
 * @param {string} userId
 * @param {string} date     YYYY-MM-DD
 * @param {boolean} allDone
 */
const _syncCompletion = async (userId, date, allDone) => {
  if (allDone) {
    await GoalCompletion.findOneAndUpdate(
      { userId, date },
      { userId, date },
      { upsert: true }
    );
  } else {
    await GoalCompletion.deleteOne({ userId, date });
  }
  await _recalculateStreak(userId);
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
    // A task may link to a whole course (courseId only) or a specific
    // video within it (both IDs) - persist whatever was provided
    if (courseId) newTask.courseId = courseId;
    if (videoId && courseId) newTask.videoId = videoId;

    goal.tasks.push(newTask);
    goal.completed = false;
    await goal.save();

    // A new (not-done) task means the day is no longer complete — remove any
    // stale GoalCompletion and recalculate the streak
    await _syncCompletion(userId, today, false);

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
    const date = req.query.date || getTodayString();
    const today = getTodayString();

    const goal = await Goal.findOne({ userId, date, type: "daily" });
    if (!goal) {
      return next(new AppError("No goal found for this date.", 404));
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

    // Mirror the completion state either way: record it when the day is done,
    // remove it when a task was un-toggled — then recalculate the streak
    await _syncCompletion(userId, date, allDone);

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
    const date = req.query.date || getTodayString();

    const goal = await Goal.findOne({ userId, date, type: "daily" });
    if (!goal) {
      return next(new AppError("No goal found for this date.", 404));
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

    // Deleting a task can flip the day either way (last undone task removed →
    // complete; last task removed → not complete) — sync and recalculate
    await _syncCompletion(userId, date, allDone);

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
 * Walks through all GoalCompletion records to find the longest consecutive
 * run (max goal streak). Saves only `maxGoalStreak` to the User document.
 *
 * The *current* goal streak is intentionally NOT saved — it is computed
 * on the fly by the read endpoints so it stays accurate even if the user
 * doesn't log in for several days.
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
    await User.findByIdAndUpdate(userId, { maxGoalStreak: 0 });
    return;
  }

  // Compute max streak from the records themselves (longest consecutive
  // run), so a rolled-back completion doesn't leave an inflated max behind.
  // completions are sorted date-descending; walk them counting runs.
  let maxStreak = 0;
  let run = 0;
  let prev = null;
  for (const { date } of completions) {
    if (prev !== null) {
      const gap = (new Date(prev) - new Date(date)) / 86400000;
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > maxStreak) maxStreak = run;
    prev = date;
  }

  await User.findByIdAndUpdate(userId, { maxGoalStreak: maxStreak });
};

// ─── Get Weekly Goal ──────────────────────────────────────────────────────────

/**
 * @route   GET /api/goals/weekly
 * @desc    Get or create the weekly goal for the current week (keyed by Monday).
 * @access  Protected
 */
const getWeekly = async (req, res, next) => {
  try {
    const userId = req.userId;
    const monday = getMondayString();

    let goal = await Goal.findOne({ userId, date: monday, type: "weekly" });

    if (!goal) {
      goal = await Goal.create({
        userId,
        date: monday,
        type: "weekly",
        description: "",
        tasks: [],
      });
    }

    res.status(200).json({ goal, weekStart: monday });
  } catch (err) {
    next(err);
  }
};

// ─── Add Weekly Task ──────────────────────────────────────────────────────────

/**
 * @route   POST /api/goals/weekly/tasks
 * @desc    Add a task to this week's weekly goal.
 * @body    { text: string, videoId?, courseId? }
 * @access  Protected
 */
const addWeeklyTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const monday = getMondayString();
    const { text, videoId, courseId } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return next(new AppError("Task text is required.", 400));
    }

    const safeText = text.trim().slice(0, 200);

    let goal = await Goal.findOne({ userId, date: monday, type: "weekly" });
    if (!goal) {
      goal = await Goal.create({
        userId,
        date: monday,
        type: "weekly",
        description: "",
        tasks: [],
      });
    }

    if (goal.tasks.length >= 30) {
      return next(new AppError("Maximum 30 tasks per week.", 400));
    }

    const newTask = { text: safeText, done: false };
    // A task may link to a whole course (courseId only) or a specific
    // video within it (both IDs) - persist whatever was provided
    if (courseId) newTask.courseId = courseId;
    if (videoId && courseId) newTask.videoId = videoId;

    goal.tasks.push(newTask);
    goal.completed = false;
    await goal.save();

    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle Weekly Task ───────────────────────────────────────────────────────

/**
 * @route   PATCH /api/goals/weekly/tasks/:taskId
 * @desc    Toggle a weekly task's done status.
 * @access  Protected
 */
const toggleWeeklyTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { taskId } = req.params;
    const monday = getMondayString();

    const goal = await Goal.findOne({ userId, date: monday, type: "weekly" });
    if (!goal) {
      return next(new AppError("No weekly goal found.", 404));
    }

    const task = goal.tasks.id(taskId);
    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    task.done = !task.done;

    const allDone = goal.tasks.length > 0 && goal.tasks.every((t) => t.done);
    goal.completed = allDone;
    await goal.save();

    res.status(200).json({ goal, allCompleted: allDone });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Weekly Task ───────────────────────────────────────────────────────

/**
 * @route   DELETE /api/goals/weekly/tasks/:taskId
 * @desc    Remove a task from this week's weekly goal.
 * @access  Protected
 */
const deleteWeeklyTask = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { taskId } = req.params;
    const monday = getMondayString();

    const goal = await Goal.findOne({ userId, date: monday, type: "weekly" });
    if (!goal) {
      return next(new AppError("No weekly goal found.", 404));
    }

    const task = goal.tasks.id(taskId);
    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    task.deleteOne();

    const allDone = goal.tasks.length > 0 && goal.tasks.every((t) => t.done);
    goal.completed = allDone;
    await goal.save();

    res.status(200).json({ goal });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getToday, getByDate, saveGoal, addTask, toggleTask, deleteTask, getHistory,
  getWeekly, addWeeklyTask, toggleWeeklyTask, deleteWeeklyTask,
};
