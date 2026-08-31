const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const AppError = require("../utils/AppError");
const DailyActivity = require("../models/DailyActivity");
const { getTodayString, toDateString } = require("../utils/dateHelpers");

// ─── Update Profile (name + username) ─────────────────────────────────────────

/**
 * @route   PUT /api/users/profile
 * @desc    Update the authenticated user's name and/or username
 * @access  Protected
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, username } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // Validate name
    if (name !== undefined) {
      if (!name.trim()) {
        return next(new AppError("Name cannot be empty.", 400));
      }
      user.name = name.trim();
    }

    // Validate username
    if (username !== undefined) {
      const cleaned = username.trim().toLowerCase();

      if (cleaned.length < 3 || cleaned.length > 30) {
        return next(new AppError("Username must be between 3 and 30 characters.", 400));
      }

      if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
        return next(new AppError("Username can only contain letters, numbers, and underscores.", 400));
      }

      // Check uniqueness (exclude current user)
      const existing = await User.findOne({ username: cleaned, _id: { $ne: user._id } });
      if (existing) {
        return next(new AppError("That username is already taken.", 409));
      }

      user.username = cleaned;
    }

    await user.save();

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// ─── Upload Profile Image ─────────────────────────────────────────────────────

/**
 * @route   PUT /api/users/profile/image
 * @desc    Upload or replace the authenticated user's profile image via Cloudinary
 * @access  Protected
 */
const updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError("No image file provided.", 400));
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // Delete old image from Cloudinary if one exists
    if (user.profileImagePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profileImagePublicId);
      } catch (_) {
        // Non-fatal — old image cleanup can fail silently
      }
    }

    // Upload new image to Cloudinary from the buffer
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "learnr/avatars",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// ─── Remove Profile Image ────────────────────────────────────────────────────

/**
 * @route   DELETE /api/users/profile/image
 * @desc    Remove the authenticated user's profile image
 * @access  Protected
 */
const removeProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // Delete from Cloudinary
    if (user.profileImagePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profileImagePublicId);
      } catch (_) {
        // Non-fatal
      }
    }

    user.profileImage = "";
    user.profileImagePublicId = "";
    await user.save();

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// ─── Analytics Helpers ────────────────────────────────────────────────────────

const _parseLocalDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const _resolveStartDate = (range, todayStr) => {
  const d = _parseLocalDate(todayStr);
  switch (range) {
    case "30d": d.setDate(d.getDate() - 29); return toDateString(d);
    case "90d": d.setDate(d.getDate() - 89); return toDateString(d);
    case "year": return `${todayStr.slice(0, 4)}-01-01`;
    case "all": return null;
    default: return undefined;
  }
};

const _fillDateGaps = (records, startDate, endDate) => {
  const recordMap = {};
  for (const r of records) {
    const hasActivity = r.totalWatchSeconds > 0 || r.videosWatchedCount > 0;
    recordMap[r.date] = {
      count: hasActivity ? Math.max(r.videosWatchedCount, 1) : 0,
      totalSeconds: r.totalWatchSeconds,
    };
  }

  const windowStart = startDate ?? (records.length > 0 ? records[0].date : endDate);
  const result = [];
  const cursor = _parseLocalDate(windowStart);
  let dateStr = toDateString(cursor);

  while (dateStr <= endDate) {
    result.push({
      date: dateStr,
      count: recordMap[dateStr]?.count ?? 0,
      totalSeconds: recordMap[dateStr]?.totalSeconds ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    dateStr = toDateString(cursor);
  }

  return result;
};

const _getDailyBreakdown = async (userObjId) => {
  const records = await DailyActivity.aggregate([
    { $match: { userId: userObjId } },
    { $sort: { date: 1 } },
    {
      $project: {
        _id: 0,
        date: 1,
        videosWatched: "$videosWatchedCount",
        totalSeconds: "$totalWatchSeconds",
      },
    },
  ]);

  if (records.length === 0) return [];

  const recordMap = {};
  for (const r of records) {
    const hasActivity = r.totalSeconds > 0 || r.videosWatched > 0;
    recordMap[r.date] = {
      videosWatched: hasActivity ? Math.max(r.videosWatched, 1) : 0,
      totalSeconds: r.totalSeconds,
    };
  }

  const result = [];
  const cursor = _parseLocalDate(records[0].date);
  const todayStr = getTodayString();
  let dateStr = toDateString(cursor);

  while (dateStr <= todayStr) {
    result.push({
      date: dateStr,
      videosWatched: recordMap[dateStr]?.videosWatched ?? 0,
      totalSeconds: recordMap[dateStr]?.totalSeconds ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    dateStr = toDateString(cursor);
  }

  return result;
};

const _getMonthlyBreakdown = async (userObjId) => {
  return DailyActivity.aggregate([
    { $match: { userId: userObjId } },
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
    {
      $group: {
        _id: { $substr: ["$date", 0, 7] },
        videosWatched: { $sum: "$effectiveVideos" },
        totalSeconds: { $sum: "$totalWatchSeconds" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        month: "$_id",
        videosWatched: 1,
        totalSeconds: 1,
      },
    },
  ]);
};

const _getYearlyBreakdown = async (userObjId) => {
  return DailyActivity.aggregate([
    { $match: { userId: userObjId } },
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
    {
      $group: {
        _id: { $substr: ["$date", 0, 4] },
        videosWatched: { $sum: "$effectiveVideos" },
        totalSeconds: { $sum: "$totalWatchSeconds" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        year: "$_id",
        videosWatched: 1,
        totalSeconds: 1,
      },
    },
  ]);
};

// ─── Analytics Controllers ────────────────────────────────────────────────────

/**
 * @route   GET /api/users/analytics/heatmap
 */
const getHeatmap = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const userObjId = new mongoose.Types.ObjectId(req.userId);
    const { range = "30d", year } = req.query;

    const todayStr = getTodayString();
    const currentYear = parseInt(todayStr.slice(0, 4), 10);

    let startDate, endDate;

    if (year) {
      const yr = parseInt(year, 10);
      if (isNaN(yr) || yr < 2000 || yr > currentYear) {
        return next(new AppError('Invalid year parameter.', 400));
      }
      startDate = `${yr}-01-01`;
      endDate = yr === currentYear ? todayStr : `${yr}-12-31`;
      const records = await DailyActivity.find({ userId: userObjId, date: { $gte: startDate, $lte: endDate } })
        .select("date videosWatchedCount totalWatchSeconds").sort({ date: 1 });
      const heatmap = _fillDateGaps(records, startDate, endDate);
      return res.status(200).json({ year: yr, heatmap });
    }

    startDate = _resolveStartDate(range, todayStr);
    endDate = todayStr;

    if (startDate === undefined) return next(new AppError('Invalid range. Use: 30d | 90d | year | all', 400));

    const matchStage = { userId: userObjId };
    if (range !== "all") matchStage.date = { $gte: startDate };

    const records = await DailyActivity.find(matchStage)
      .select("date videosWatchedCount totalWatchSeconds").sort({ date: 1 });
    const heatmap = _fillDateGaps(records, startDate, endDate);

    res.status(200).json({ range, heatmap });
  } catch (err) { next(err); }
};

/**
 * @route   GET /api/users/analytics/heatmap/years
 */
const getHeatmapYears = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const userObjId = new mongoose.Types.ObjectId(req.userId);
    const result = await DailyActivity.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: { $substr: ["$date", 0, 4] } } },
      { $sort: { _id: -1 } },
    ]);
    const years = result.map((r) => parseInt(r._id, 10));
    const currentYear = parseInt(getTodayString().slice(0, 4), 10);
    if (!years.includes(currentYear)) years.unshift(currentYear);
    years.sort((a, b) => b - a);
    res.status(200).json({ years });
  } catch (err) { next(err); }
};

/**
 * @route   GET /api/users/analytics/summary
 */
const getSummary = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const userObjId = new mongoose.Types.ObjectId(req.userId);
    const [daily, monthly, yearly] = await Promise.all([
      _getDailyBreakdown(userObjId),
      _getMonthlyBreakdown(userObjId),
      _getYearlyBreakdown(userObjId),
    ]);
    res.status(200).json({ daily, monthly, yearly });
  } catch (err) { next(err); }
};
// ─── Activity Streak (Profile) ────────────────────────────────────────────────

/**
 * @route   GET /api/users/activity-streak
 * @desc    Compute the current video-watching activity streak on the fly
 *          by walking backwards through DailyActivity records, and return
 *          it alongside the persisted `maxActivityStreak`.
 * @access  Protected
 */
const getActivityStreak = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const userId = req.userId;
    const userObjId = new mongoose.Types.ObjectId(userId);

    // Fetch active days (sorted descending) and user in parallel
    const [activities, user] = await Promise.all([
      DailyActivity.find({ userId: userObjId })
        .sort({ date: -1 })
        .limit(365)
        .select("date videosWatchedCount totalWatchSeconds")
        .lean(),
      User.findById(userId).select("maxActivityStreak").lean(),
    ]);

    // Only count days with actual watch activity
    const activeDates = new Set(
      activities
        .filter((a) => a.totalWatchSeconds > 0 || a.videosWatchedCount > 0)
        .map((a) => a.date)
    );

    let currentStreak = 0;

    if (activeDates.size > 0) {
      const todayStr = getTodayString();
      const checkDate = new Date();

      // If today has no activity, start from yesterday
      if (!activeDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 365; i++) {
        const dateStr = toDateString(checkDate);
        if (activeDates.has(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    res.status(200).json({
      currentActivityStreak: currentStreak,
      maxActivityStreak: user?.maxActivityStreak ?? 0,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateProfile, updateProfileImage, removeProfileImage,
  getHeatmap, getHeatmapYears, getSummary, getActivityStreak
};
