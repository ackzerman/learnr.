const Video = require("../models/Video");
const Course = require("../models/Course");
const Progress = require("../models/Progress");
const DailyActivity = require("../models/DailyActivity");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getTodayString, toDateString } = require("../utils/dateHelpers");

// ─── Helper: Recalculate Max Activity Streak ──────────────────────────────────

/**
 * Walks all DailyActivity records (sorted by date) to find the longest
 * consecutive run of days with video-watching activity, and persists
 * `maxActivityStreak` to the User document.
 *
 * The *current* activity streak is NOT saved — it is computed on the fly
 * when the Profile page requests it.
 *
 * @param {string} userId
 */
const _recalculateMaxActivityStreak = async (userId) => {
  const activities = await DailyActivity.find({ userId })
    .sort({ date: -1 })
    .limit(365)
    .select("date videosWatchedCount totalWatchSeconds")
    .lean();

  // Only count days with actual watch activity
  const activeDates = activities
    .filter((a) => a.totalWatchSeconds > 0 || a.videosWatchedCount > 0)
    .map((a) => a.date);

  if (activeDates.length === 0) {
    await User.findByIdAndUpdate(userId, { maxActivityStreak: 0 });
    return;
  }

  // activeDates is sorted descending — walk them counting consecutive runs
  let maxStreak = 0;
  let run = 0;
  let prev = null;
  for (const date of activeDates) {
    if (prev !== null) {
      const gap = (new Date(prev) - new Date(date)) / 86400000;
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > maxStreak) maxStreak = run;
    prev = date;
  }

  await User.findByIdAndUpdate(userId, { maxActivityStreak: maxStreak });
};

/**
 * Load a video and verify its course belongs to the given user.
 * Returns the video, or null if it doesn't exist / isn't the user's —
 * callers respond 404 either way so foreign IDs aren't distinguishable.
 */
const _findOwnedVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId);
  if (!video) return null;
  const course = await Course.findById(video.courseId).select("userId").lean();
  if (!course || course.userId.toString() !== userId.toString()) return null;
  return video;
};

// ─── Update Video Progress ────────────────────────────────────────────────────

/**
 * @route   POST /api/progress
 * @desc    Record watch progress for a video, update daily activity and streak.
 *          Safe to call repeatedly — uses max() for watchedSeconds and
 *          upserts DailyActivity to prevent duplicate inflation.
 * @access  Protected
 *
 * Body: {
 *   videoId        : string  (required)
 *   watchedSeconds : number  (required, >= 0)
 * }
 */
const updateProgress = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { videoId, watchedSeconds } = req.body;

    // ── 1. Validate input ─────────────────────────────────────────────────────

    if (!videoId) {
      return next(new AppError("videoId is required.", 400));
    }

    if (typeof watchedSeconds !== "number" || watchedSeconds < 0) {
      return next(new AppError("watchedSeconds must be a non-negative number.", 400));
    }

    // ── 2. Load the video to know its full duration ───────────────────────────
    // Ownership-checked: the video's course must belong to this user

    const video = await _findOwnedVideo(videoId, userId);
    if (!video) {
      return next(new AppError("Video not found.", 404));
    }

    // ── 3. Load or create the Progress record for this user + video ───────────

    let progress = await Progress.findOne({ userId, videoId });

    const isNewProgress = !progress;

    if (isNewProgress) {
      progress = new Progress({ userId, videoId, watchedSeconds: 0, completed: false });
    }

    // Capture original lastWatchedAt before we overwrite it (needed for DailyActivity logic).
    // Local date string — must use the same convention as getTodayString, or
    // evening sessions in non-UTC timezones count the video as "first watch"
    // on every ping and inflate videosWatchedCount.
    const previousLastWatchedDate = !isNewProgress && progress.lastWatchedAt
      ? toDateString(progress.lastWatchedAt)
      : null;

    // ── 4. Calculate the delta before updating ────────────────────────────────
    // Delta = how many NEW seconds were watched since the last call.
    // This prevents double-counting when the client sends the same position twice.

    const previousSeconds = progress.watchedSeconds;
    // Clamp to video duration — prevents clients from inflating stats
    const clampedWatched = Math.min(watchedSeconds, video.duration);
    const newWatchedSeconds = Math.max(previousSeconds, clampedWatched);
    const deltaSeconds = newWatchedSeconds - previousSeconds; // 0 if no new progress

    // ── 5. Update progress fields ─────────────────────────────────────────────

    progress.watchedSeconds = newWatchedSeconds;
    progress.lastWatchedAt = new Date();

    // Mark complete when >= 90% of the video has been watched
    const completionThreshold = video.duration * 0.9;
    const justCompleted =
      !progress.completed && progress.watchedSeconds >= completionThreshold;

    if (justCompleted) {
      progress.completed = true;
    }

    await progress.save();

    // ── 6. Update DailyActivity ───────────────────────────────────────────────
    // Record activity when there are genuinely new seconds watched, or
    // when a video is touched for the first time today.

    const today = getTodayString();

    // Determine if this is the first progress update for this video today.
    // Uses the original lastWatchedAt captured before we updated it.
    const isFirstWatchToday = isNewProgress || previousLastWatchedDate !== today;

    if (deltaSeconds > 0 || isFirstWatchToday) {
      // findOneAndUpdate with upsert avoids race conditions and duplicate docs.
      // $inc atomically increments both counters in a single DB operation.
      await DailyActivity.findOneAndUpdate(
        { userId, date: today },
        {
          $inc: {
            videosWatchedCount: isFirstWatchToday ? 1 : 0, // Count each video once per day
            totalWatchSeconds: deltaSeconds,
          },
        },
        { upsert: true, new: true }
      );
      // Recalculate max activity streak after recording new activity
      await _recalculateMaxActivityStreak(userId);
    }

    // ── 7. Respond ────────────────────────────────────────────────────────────
    // Streak is now driven by daily goal completion, not video progress.
    // See goalController.js for streak logic.

    res.status(200).json({
      progress,
      completed: progress.completed,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle Star ──────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/progress/:videoId/star
 * @desc    Toggle the starred flag on a user's progress record for a video.
 *          Creates a minimal Progress record if one doesn't exist yet
 *          (user can star a video before watching it).
 * @access  Protected
 */
async function toggleStar(req, res, next) {
  try {
    const userId = req.userId;
    const { videoId } = req.params;

    // Validate the video exists and belongs to this user
    const video = await _findOwnedVideo(videoId, userId);
    if (!video) {
      return next(new AppError("Video not found.", 404));
    }

    // Find or create a progress record for this user + video
    let progress = await Progress.findOne({ userId, videoId });

    if (!progress) {
      progress = await Progress.create({
        userId,
        videoId,
        watchedSeconds: 0,
        completed: false,
        starred: true,   // first action is always starring
      });
    } else {
      progress.starred = !progress.starred;
      await progress.save();
    }

    res.status(200).json({ videoId, starred: progress.starred });
  } catch (err) {
    next(err);
  }
}

module.exports = { updateProgress, toggleStar };
