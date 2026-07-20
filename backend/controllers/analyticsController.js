const mongoose      = require("mongoose");
const DailyActivity = require("../models/DailyActivity");
const AppError      = require("../utils/AppError");
const { getTodayString, toDateString } = require("../utils/dateHelpers");

/**
 * Parse a "YYYY-MM-DD" string into a local-time Date at midnight.
 * (new Date("YYYY-MM-DD") parses as UTC, which shifts the day in
 * behind-UTC timezones — this keeps everything in local time, matching
 * how DailyActivity.date keys are written.)
 */
const _parseLocalDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ─── Heatmap ──────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/analytics/heatmap?range=30d|90d|year|all&year=YYYY
 * @desc    Return per-day activity counts for the requested date range.
 *          If `year` query param is provided, returns data for that specific
 *          calendar year (Jan 1 – Dec 31, capped at today for current year).
 *          Gaps (days with no activity) are filled with count: 0 so the
 *          frontend heatmap always receives a complete, contiguous window.
 * @access  Protected
 */
const getHeatmap = async (req, res, next) => {
  try {
    const userObjId = new mongoose.Types.ObjectId(req.userId);
    const { range = "30d", year } = req.query;

    // Local-time "today" string — DailyActivity.date keys are local dates
    const todayStr = getTodayString();
    const currentYear = parseInt(todayStr.slice(0, 4), 10);

    let startDate, endDate;

    // ── Year-specific mode ────────────────────────────────────────────────────
    if (year) {
      const yr = parseInt(year, 10);
      if (isNaN(yr) || yr < 2000 || yr > currentYear) {
        return next(new AppError('Invalid year parameter.', 400));
      }

      startDate = `${yr}-01-01`;
      // For current year, cap at today; for past years, go to Dec 31
      endDate = yr === currentYear ? todayStr : `${yr}-12-31`;

      const matchStage = {
        userId: userObjId,
        date: { $gte: startDate, $lte: endDate },
      };

      const records = await DailyActivity.find(matchStage)
        .select("date videosWatchedCount totalWatchSeconds")
        .sort({ date: 1 });

      const heatmap = _fillDateGaps(records, startDate, endDate);

      return res.status(200).json({ year: yr, heatmap });
    }

    // ── Range-based mode (original behavior) ──────────────────────────────────
    startDate = _resolveStartDate(range, todayStr);
    endDate = todayStr;

    if (startDate === undefined) {
      return next(new AppError('Invalid range. Use: 30d | 90d | year | all', 400));
    }

    const matchStage = { userId: userObjId };

    // "all" has no lower bound — fetch the user's entire history
    if (range !== "all") {
      matchStage.date = { $gte: startDate };
    }

    const records = await DailyActivity.find(matchStage)
      .select("date videosWatchedCount totalWatchSeconds")
      .sort({ date: 1 });

    const heatmap = _fillDateGaps(records, startDate, endDate);

    res.status(200).json({ range, heatmap });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/analytics/heatmap/years
 * @desc    Return all distinct years the user has activity data.
 *          Always includes the current year.
 * @access  Protected
 */
const getHeatmapYears = async (req, res, next) => {
  try {
    const userObjId = new mongoose.Types.ObjectId(req.userId);

    const result = await DailyActivity.aggregate([
      { $match: { userId: userObjId } },
      {
        $group: {
          _id: { $substr: ["$date", 0, 4] }, // extract "YYYY"
        },
      },
      { $sort: { _id: -1 } },  // newest first
    ]);

    const years = result.map((r) => parseInt(r._id, 10));

    // Ensure current year is always included (local time — matches date keys)
    const currentYear = parseInt(getTodayString().slice(0, 4), 10);
    if (!years.includes(currentYear)) {
      years.unshift(currentYear);
    }

    // Sort descending
    years.sort((a, b) => b - a);

    res.status(200).json({ years });
  } catch (err) {
    next(err);
  }
};

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/analytics/summary
 * @desc    Return aggregated activity broken down by day, month, and year.
 *          All three aggregations run in parallel for efficiency.
 * @access  Protected
 *
 * Response shape:
 * {
 *   daily:   [ { date: "YYYY-MM-DD", videosWatched, totalSeconds } ]
 *   monthly: [ { month: "YYYY-MM",   videosWatched, totalSeconds } ]
 *   yearly:  [ { year:  "YYYY",      videosWatched, totalSeconds } ]
 * }
 */
const getSummary = async (req, res, next) => {
  try {
    const userObjId = new mongoose.Types.ObjectId(req.userId);

    // Run all three aggregations concurrently
    const [daily, monthly, yearly] = await Promise.all([
      _getDailyBreakdown(userObjId),
      _getMonthlyBreakdown(userObjId),
      _getYearlyBreakdown(userObjId),
    ]);

    res.status(200).json({ daily, monthly, yearly });
  } catch (err) {
    next(err);
  }
};

// ─── Aggregation: Daily ───────────────────────────────────────────────────────

/**
 * Returns raw daily activity records sorted chronologically.
 * No grouping needed — DailyActivity is already bucketed by day.
 *
 * @param   {ObjectId} userObjId
 * @returns {Promise<{ date, videosWatched, totalSeconds }[]>}
 */
const _getDailyBreakdown = async (userObjId) => {
  const records = await DailyActivity.aggregate([
    { $match: { userId: userObjId } },
    { $sort:  { date: 1 } },
    {
      $project: {
        _id:          0,
        date:         1,
        videosWatched: "$videosWatchedCount",
        totalSeconds: "$totalWatchSeconds",
      },
    },
  ]);

   if (records.length === 0) return [];
 
  // Build an O(1) lookup map from the DB results.
  // Ensure any day with watch activity shows at least videosWatched=1,
  // even when videosWatchedCount is 0 (user continued a previously-started video).
  const recordMap = {};
  for (const r of records) {
    const hasActivity = r.totalSeconds > 0 || r.videosWatched > 0;
    recordMap[r.date] = {
      videosWatched: hasActivity ? Math.max(r.videosWatched, 1) : 0,
      totalSeconds:  r.totalSeconds,
    };
  }

  //Walk day-by-day from the earliest record to today, filling any gaps with zeros

  const result   = [];
  const cursor   = _parseLocalDate(records[0].date);
  const todayStr = getTodayString();

  let dateStr = toDateString(cursor);
  while (dateStr <= todayStr) {
    result.push({
      date:          dateStr,
      videosWatched: recordMap[dateStr]?.videosWatched ?? 0,
      totalSeconds:  recordMap[dateStr]?.totalSeconds  ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    dateStr = toDateString(cursor);
  }

  return result;
};



// ─── Aggregation: Monthly ─────────────────────────────────────────────────────

/**
 * Groups all daily records into YYYY-MM buckets and sums each metric.
 *
 * Pipeline:
 *   1. Match this user's records
 *   2. $substr slices the first 7 characters of "YYYY-MM-DD" → "YYYY-MM"
 *   3. $group accumulates the sums per month bucket
 *   4. $sort chronologically
 *   5. $project clean output shape
 *
 * @param   {ObjectId} userObjId
 * @returns {Promise<{ month, videosWatched, totalSeconds }[]>}
 */
const _getMonthlyBreakdown = async (userObjId) => {
  return DailyActivity.aggregate([
    { $match: { userId: userObjId } },

    // Derive a corrected video count: at least 1 if there's any watch activity
    {
      $addFields: {
        effectiveVideos: {
          $cond: {
            if: { $or: [{ $gt: ["$totalWatchSeconds", 0] }, { $gt: ["$videosWatchedCount", 0] }] },
            then: { $max: ["$videosWatchedCount", 1] },
            else: 0,
          },
        },
      },
    },

    // Extract "YYYY-MM" from the "YYYY-MM-DD" string
    {
      $group: {
        _id:          { $substr: ["$date", 0, 7] }, // "2024-07"
        videosWatched: { $sum: "$effectiveVideos" },
        totalSeconds: { $sum: "$totalWatchSeconds" },
      },
    },

    { $sort: { _id: 1 } },

    {
      $project: {
        _id:          0,
        month:        "$_id",
        videosWatched: 1,
        totalSeconds: 1,
      },
    },
  ]);
};

// ─── Aggregation: Yearly ──────────────────────────────────────────────────────

/**
 * Groups all daily records into YYYY buckets and sums each metric.
 *
 * Same approach as monthly but slices only the first 4 characters → "YYYY".
 *
 * @param   {ObjectId} userObjId
 * @returns {Promise<{ year, videosWatched, totalSeconds }[]>}
 */
const _getYearlyBreakdown = async (userObjId) => {
  return DailyActivity.aggregate([
    { $match: { userId: userObjId } },

    // Derive a corrected video count: at least 1 if there's any watch activity
    {
      $addFields: {
        effectiveVideos: {
          $cond: {
            if: { $or: [{ $gt: ["$totalWatchSeconds", 0] }, { $gt: ["$videosWatchedCount", 0] }] },
            then: { $max: ["$videosWatchedCount", 1] },
            else: 0,
          },
        },
      },
    },

    // Extract "YYYY" from the "YYYY-MM-DD" string
    {
      $group: {
        _id:          { $substr: ["$date", 0, 4] }, // "2024"
        videosWatched: { $sum: "$effectiveVideos" },
        totalSeconds: { $sum: "$totalWatchSeconds" },
      },
    },

    { $sort: { _id: 1 } },

    {
      $project: {
        _id:          0,
        year:         "$_id",
        videosWatched: 1,
        totalSeconds: 1,
      },
    },
  ]);
};

// ─── Utility: Resolve Range Start Date ───────────────────────────────────────

/**
 * Maps a range string to a local "YYYY-MM-DD" start date, or null for "all".
 *
 * @param   {string} range     "30d" | "90d" | "year" | "all"
 * @param   {string} todayStr  local "YYYY-MM-DD"
 * @returns {string|null|undefined}
 */
const _resolveStartDate = (range, todayStr) => {
  const d = _parseLocalDate(todayStr);

  switch (range) {
    case "30d":
      d.setDate(d.getDate() - 29);   // today + 29 previous days = 30 days total
      return toDateString(d);
    case "90d":
      d.setDate(d.getDate() - 89);
      return toDateString(d);
    case "year":
      return `${todayStr.slice(0, 4)}-01-01`; // Jan 1 of the current year
    case "all":
      return null;                          // no lower bound — caller handles this
    default:
      return undefined;                     // signals an invalid range value
  }
};

// ─── Utility: Fill Date Gaps ──────────────────────────────────────────────────

/**
 * Merges DB records with a complete day-by-day calendar window.
 * Any date missing from DB records is filled in with zeroed counts.
 * All dates are local "YYYY-MM-DD" strings, matching DailyActivity.date keys.
 *
 * @param   {object[]}    records   — DailyActivity documents from DB
 * @param   {string|null} startDate — inclusive start (null = use earliest record)
 * @param   {string}      endDate   — inclusive end
 * @returns {{ date: string, count: number, totalSeconds: number }[]}
 */
const _fillDateGaps = (records, startDate, endDate) => {
  // Build O(1) lookup map from DB records
  // Ensure any day with watch activity shows at least count=1,
  // even when videosWatchedCount is 0 (user continued a previously-started video).
  const recordMap = {};
  for (const r of records) {
    const hasActivity = r.totalWatchSeconds > 0 || r.videosWatchedCount > 0;
    recordMap[r.date] = {
      count:        hasActivity ? Math.max(r.videosWatchedCount, 1) : 0,
      totalSeconds: r.totalWatchSeconds,
    };
  }

  // For "all" range — use the earliest record date as the window start
  const windowStart =
    startDate ??
    (records.length > 0 ? records[0].date : endDate);

  // Walk day-by-day from start → endDate and fill in every date
  const result = [];
  const cursor = _parseLocalDate(windowStart);

  let dateStr = toDateString(cursor);
  while (dateStr <= endDate) {
    result.push({
      date:         dateStr,
      count:        recordMap[dateStr]?.count        ?? 0,
      totalSeconds: recordMap[dateStr]?.totalSeconds ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    dateStr = toDateString(cursor);
  }

  return result;
};

module.exports = { getHeatmap, getHeatmapYears, getSummary };