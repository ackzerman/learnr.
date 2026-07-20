const GoalCompletion = require("../models/GoalCompletion");
const User = require("../models/User");
const { getTodayString, toDateString } = require("../utils/dateHelpers");

// ─── Get Streak Data ──────────────────────────────────────────────────────────

/**
 * @route   GET /api/streak
 * @desc    Returns the user's current streak, max streak, and last 7 days
 *          of goal completion status for the calendar strip.
 * @query   ?month=YYYY-MM  (optional: get a full month of completion data)
 * @access  Protected
 */
const getStreak = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { month } = req.query;

    // If a month is specified, return the full month of data
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      return _getMonthData(req, res, next, userId, month);
    }

    // Default: last 7 days + streak count
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // Local date string — GoalCompletion.date keys are written in local time
      const dateStr = toDateString(d);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      days.push({
        date: dateStr,
        dayLabel: dayNames[d.getDay()],
        isToday: i === 0,
        active: false, // will be filled below
      });
    }

    // Query completions for these 7 days
    const dateStrings = days.map((d) => d.date);
    const completions = await GoalCompletion.find({
      userId,
      date: { $in: dateStrings },
    })
      .select("date")
      .lean();

    const completedSet = new Set(completions.map((c) => c.date));
    for (const day of days) {
      day.active = completedSet.has(day.date);
    }

    // Calculate streak from DB
    const allCompletions = await GoalCompletion.find({ userId })
      .sort({ date: -1 })
      .limit(365)
      .select("date")
      .lean();

    const allDatesSet = new Set(allCompletions.map((c) => c.date));
    const todayStr = getTodayString();

    let streak = 0;
    const checkDate = new Date();

    // If today isn't completed, start checking from yesterday
    if (!allDatesSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
      const dateStr = toDateString(checkDate);
      if (allDatesSet.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Get max streak from user
    const user = await User.findById(userId).select("maxStreak").lean();

    res.status(200).json({
      currentStreak: streak,
      maxStreak: user?.maxStreak ?? 0,
      last7Days: days,
      completedToday: completedSet.has(todayStr),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helper: Get Full Month Data ──────────────────────────────────────────────

/**
 * Returns completion data for every day in the specified month.
 * Enables the frontend to render a full calendar view for historical months.
 */
const _getMonthData = async (req, res, next, userId, month) => {
  try {
    // Parse month to get first and last day
    const [year, mon] = month.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    const lastDay = new Date(Date.UTC(year, mon, 0)); // last day of month

    const days = [];
    const d = new Date(firstDay);
    while (d <= lastDay) {
      days.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const completions = await GoalCompletion.find({
      userId,
      date: { $gte: days[0], $lte: days[days.length - 1] },
    })
      .select("date")
      .lean();

    const completedSet = new Set(completions.map((c) => c.date));

    const monthDays = days.map((date) => ({
      date,
      active: completedSet.has(date),
    }));

    res.status(200).json({ month, days: monthDays });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStreak };
