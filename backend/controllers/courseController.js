const mongoose  = require("mongoose");
const Course    = require("../models/Course");
const Video     = require("../models/Video");
const Progress  = require("../models/Progress");
const Note      = require("../models/Note");
const AppError  = require("../utils/AppError");
const {
  extractPlaylistId,
  fetchPlaylistTitle,
  fetchPlaylistItems,
  fetchVideoDurations,
} = require("../utils/youtubeHelpers");

// ─── Create Manual Course ─────────────────────────────────────────────────────

/**
 * @route   POST /api/courses/manual
 * @desc    Create a new course manually with a list of videos
 * @access  Protected
 */
const createManualCourse = async (req, res, next) => {
  try {
    const { title, tags = [], videos } = req.body;
    const userId = req.userId;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return next(new AppError("Course title is required.", 400));
    }
    if (!Array.isArray(videos) || videos.length === 0) {
      return next(new AppError("At least one video is required.", 400));
    }
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (!v.title || typeof v.title !== "string" || v.title.trim() === "") {
        return next(new AppError(`Video at index ${i} is missing a title.`, 400));
      }
      if (typeof v.duration !== "number" || v.duration <= 0) {
        return next(new AppError(`Video at index ${i} must have a positive duration (in seconds).`, 400));
      }
    }

    const totalVideos   = videos.length;
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    const course = await Course.create({
      userId,
      title:        title.trim(),
      source:       "manual",
      // Sanitize tags — trim, lowercase, limit length and count
      tags: (Array.isArray(tags) ? tags : []).slice(0, 20).map(t => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean),
      totalVideos,
      totalDuration,
    });

    const videoDocs = videos.map((v, index) => ({
      courseId:   course._id,
      title:      v.title.trim(),
      duration:   v.duration,
      orderIndex: index,
      videoUrl:   v.videoUrl || "",
    }));

    const createdVideos = await Video.insertMany(videoDocs);

    res.status(201).json({ course, videos: createdVideos });
  } catch (err) {
    next(err);
  }
};

// ─── Get All Courses (with pagination) ───────────────────────────────────────

/**
 * @route   GET /api/courses?page=1&limit=10
 * @desc    Fetch all courses for the authenticated user with pagination
 * @access  Protected
 */
const getCourses = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userObjId = new mongoose.Types.ObjectId(userId);

    // Parse pagination params — default page 1, limit 10, max limit 50
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    // Run count and fetch in parallel for efficiency
    const [total, courses] = await Promise.all([
      Course.countDocuments({ userId }),

            // Aggregation: join videos + completed progress to compute per-course stats
      Course.aggregate([
        { $match: { userId: userObjId } },
        { $sort:  { createdAt: -1 } },
        { $skip:  skip },
        { $limit: limit },
 
        // Join all videos belonging to the course
        {
          $lookup: {
            from:         "videos",
            localField:   "_id",
            foreignField: "courseId",
            as:           "videos",
          },
        },
 
        // Join only the completed progress records for this user in this course
        {
          $lookup: {
            from: "progresses",
            let:  { videoIds: "$videos._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$videoId",   "$$videoIds"] },
                      { $eq: ["$userId",    userObjId]    },
                      { $eq: ["$completed", true]         },
                    ],
                  },
                },
              },
            ],
            as: "completedProgress",
          },
        },
 
        // Project the final shape — mirrors raw Course fields plus progress stats
        {
          $project: {
            _id:                  1,
            title:                1,
            source:               1,
            tags:                 1,
            playlistUrl:          1,
            thumbnailUrl:         1,
            // Fallback: first video's URL for deriving thumbnail client-side
            firstVideoUrl:        { $arrayElemAt: ["$videos.videoUrl", 0] },
            totalVideos:          1,
            totalDuration:        1,
            createdAt:            1,
            updatedAt:            1,
            completedVideos:      { $size: "$completedProgress" },
            completionPercentage: {
              $cond: [
                { $gt: [{ $size: "$videos" }, 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: [{ $size: "$completedProgress" }, { $size: "$videos" }] },
                        100,
                      ],
                    },
                    0,
                  ],
                },
                0,
              ],
            },
          },
        },
      ])
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      courses,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Course By ID ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/courses/:id
 * @desc    Fetch a single course with all its videos
 * @access  Protected — owner only
 */
const getCourseById = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to access this course.", 403));
    }

    const videos = await Video.find({ courseId }).sort({ orderIndex: 1 });

    res.status(200).json({ course, videos });
  } catch (err) {
    next(err);
  }
};

// ─── Update Course ────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/courses/:id
 * @desc    Update a course's title and/or tags
 * @access  Protected — owner only
 *
 * Body: {
 *   title : string    (optional)
 *   tags  : string[]  (optional)
 * }
 */
const updateCourse = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const courseId = req.params.id;
    const { title, tags } = req.body;

    // ── 1. Find and authorise ─────────────────────────────────────────────────

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to update this course.", 403));
    }

    // ── 2. Validate and apply changes ─────────────────────────────────────────

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim() === "") {
        return next(new AppError("Title must be a non-empty string.", 400));
      }
      course.title = title.trim();
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return next(new AppError("Tags must be an array.", 400));
      }
      // Sanitize tags — trim, lowercase, limit length and count
      course.tags = tags.slice(0, 20).map(t => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean);
    }

    await course.save();

    res.status(200).json({ course });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Course ────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete a course and cascade-delete all associated videos,
 *          progress records, and notes.
 * @access  Protected — owner only
 */
const deleteCourse = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const courseId = req.params.id;

    // ── 1. Find and authorise ─────────────────────────────────────────────────

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to delete this course.", 403));
    }

    // ── 2. Collect all video IDs belonging to this course ─────────────────────

    const videos   = await Video.find({ courseId }).select("_id");
    const videoIds = videos.map((v) => v._id);

    // ── 3. Cascade delete — all related data removed in parallel ──────────────
    // Order: child records first, then videos, then the course itself.

    await Promise.all([
      Progress.deleteMany({ videoId: { $in: videoIds } }),
      Note.deleteMany({     videoId: { $in: videoIds } }),
    ]);

    await Video.deleteMany({ courseId });
    await Course.findByIdAndDelete(courseId);

    res.status(200).json({ message: "Course and all associated data deleted successfully." });
  } catch (err) {
    next(err);
  }
};

// ─── Add Video to Manual Course ───────────────────────────────────────────────

/**
 * @route   POST /api/courses/:id/videos
 * @desc    Append a new video to an existing manual course.
 *          YouTube courses are immutable — their videos come from the playlist.
 * @access  Protected — owner only
 *
 * Body: {
 *   title    : string  (required)
 *   duration : number  (required, seconds)
 *   videoUrl : string  (optional)
 * }
 */
const addVideo = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const courseId = req.params.id;
    const { title, duration, videoUrl = "" } = req.body;

    // ── 1. Find and authorise ─────────────────────────────────────────────────

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to modify this course.", 403));
    }
    if (course.source !== "manual") {
      return next(new AppError("Videos can only be added to manual courses.", 400));
    }

    // ── 2. Validate input ─────────────────────────────────────────────────────

    if (!title || typeof title !== "string" || title.trim() === "") {
      return next(new AppError("Video title is required.", 400));
    }
    if (typeof duration !== "number" || duration <= 0) {
      return next(new AppError("Video duration must be a positive number (seconds).", 400));
    }

    // ── 3. Determine next orderIndex ──────────────────────────────────────────
    // Find the highest existing orderIndex and increment by 1.

    const lastVideo = await Video.findOne({ courseId }).sort({ orderIndex: -1 }).select("orderIndex");
    const orderIndex = lastVideo ? lastVideo.orderIndex + 1 : 0;

    // ── 4. Create the video ───────────────────────────────────────────────────

    const video = await Video.create({
      courseId,
      title:    title.trim(),
      duration,
      videoUrl,
      orderIndex,
    });

    // ── 5. Update course aggregate totals ─────────────────────────────────────

    course.totalVideos   += 1;
    course.totalDuration += duration;
    await course.save();

    res.status(201).json({ video, course });
  } catch (err) {
    next(err);
  }
};

// ─── Remove Video from Manual Course ─────────────────────────────────────────

/**
 * @route   DELETE /api/courses/:id/videos/:videoId
 * @desc    Remove a video from a manual course and cascade-delete its
 *          progress and notes. Re-indexes remaining videos to keep
 *          orderIndex values contiguous.
 * @access  Protected — owner only
 */
const removeVideo = async (req, res, next) => {
  try {
    const userId        = req.userId;
    const courseId      = req.params.id;
    const { videoId }   = req.params;

    // ── 1. Find and authorise ─────────────────────────────────────────────────

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to modify this course.", 403));
    }
    if (course.source !== "manual") {
      return next(new AppError("Videos can only be removed from manual courses.", 400));
    }

    // ── 2. Find the video ─────────────────────────────────────────────────────

    const video = await Video.findOne({ _id: videoId, courseId });
    if (!video) {
      return next(new AppError("Video not found in this course.", 404));
    }

    // ── 3. Cascade delete progress and notes for this video ───────────────────

    await Promise.all([
      Progress.deleteMany({ videoId: video._id }),
      Note.deleteMany({     videoId: video._id }),
    ]);

    await Video.findByIdAndDelete(videoId);

    // ── 4. Re-index remaining videos so orderIndex stays contiguous ───────────

    const remaining = await Video.find({ courseId }).sort({ orderIndex: 1 });
    await Promise.all(
      remaining.map((v, idx) =>
        Video.findByIdAndUpdate(v._id, { orderIndex: idx })
      )
    );

    // ── 5. Update course aggregate totals ─────────────────────────────────────

    course.totalVideos   = Math.max(0, course.totalVideos - 1);
    course.totalDuration = Math.max(0, course.totalDuration - video.duration);
    await course.save();

    res.status(200).json({ message: "Video removed successfully.", course });
  } catch (err) {
    next(err);
  }
};

// ─── Import YouTube Playlist ──────────────────────────────────────────────────

/**
 * @route   POST /api/courses/youtube
 * @desc    Create a course by importing a YouTube playlist
 * @access  Protected
 */
const importYoutubeCourse = async (req, res, next) => {
  try {
    const { playlistUrl, tags = [] } = req.body;
    const userId = req.userId;

    if (!playlistUrl || typeof playlistUrl !== "string") {
      return next(new AppError("playlistUrl is required.", 400));
    }

    const playlistId = extractPlaylistId(playlistUrl);

    const [playlistTitle, { items }] = await Promise.all([
      fetchPlaylistTitle(playlistId),
      fetchPlaylistItems(playlistId),
    ]);

    if (items.length === 0) {
      return next(new AppError("This playlist is empty or all videos are private/deleted.", 400));
    }

    const videoIds    = items.map((v) => v.videoId);
    const durationMap = await fetchVideoDurations(videoIds);

    const totalVideos   = items.length;
    const totalDuration = items.reduce((sum, v) => sum + (durationMap[v.videoId] || 0), 0);

    const course = await Course.create({
      userId,
      title:        playlistTitle,
      source:       "youtube",
      playlistUrl,
      thumbnailUrl: items[0]?.thumbnailUrl || null,
      // Sanitize tags — trim, lowercase, limit length and count
      tags: (Array.isArray(tags) ? tags : []).slice(0, 20).map(t => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean),
      totalVideos,
      totalDuration,
    });

    const videoDocs = items.map((v, index) => ({
      courseId:      course._id,
      title:        v.title,
      videoUrl:     `https://www.youtube.com/watch?v=${v.videoId}`,
      thumbnailUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
      duration:     durationMap[v.videoId] || 0,
      orderIndex:   index,
    }));

    const createdVideos = await Video.insertMany(videoDocs);

    res.status(201).json({ course, videos: createdVideos });
  } catch (err) {
    next(err);
  }
};

// ─── Get Course Detail ────────────────────────────────────────────────────────

/**
 * @route   GET /api/courses/:id/details
 * @desc    Full course detail with per-video progress and notes merged in
 * @access  Protected
 */
const getCourseDetails = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("Course not found.", 404));
    }
    if (course.userId.toString() !== userId.toString()) {
      return next(new AppError("You are not authorised to access this course.", 403));
    }

    const videos   = await Video.find({ courseId }).sort({ orderIndex: 1 });
    const videoIds = videos.map((v) => v._id);

    const [progressList, noteList] = await Promise.all([
      Progress.find({ userId, videoId: { $in: videoIds } }),
      Note.find({     userId, videoId: { $in: videoIds } }),
    ]);

    const progressMap = new Map(progressList.map((p) => [p.videoId.toString(), p]));
    const noteMap     = new Map(noteList.map((n)     => [n.videoId.toString(), n]));

    const mergedVideos = videos.map((video) => {
      const id       = video._id.toString();
      const progress = progressMap.get(id);
      const note     = noteMap.get(id);
      return {
        videoId:      video._id,
        title:        video.title,
        videoUrl:     video.videoUrl,
        thumbnailUrl: video.thumbnailUrl || "",
        duration:     video.duration,
        orderIndex:   video.orderIndex,
        progress: {
          watchedSeconds: progress?.watchedSeconds ?? 0,
          completed:      progress?.completed      ?? false,
          lastWatchedAt:  progress?.lastWatchedAt  ?? null,
          starred:        progress?.starred        ?? false,
        },
        note: {
          content:   note?.content   ?? "",
          updatedAt: note?.updatedAt ?? null,
        },
      };
    });

    const totalVideos         = mergedVideos.length;
    const completedVideos     = mergedVideos.filter((v) => v.progress.completed).length;
    const totalWatchTime      = mergedVideos.reduce((sum, v) => sum + v.progress.watchedSeconds, 0);
    const completionPercentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

    res.status(200).json({
      course: {
        id:            course._id,
        title:         course.title,
        source:        course.source,
        tags:          course.tags,
        playlistUrl:   course.playlistUrl,
        thumbnailUrl:  course.thumbnailUrl,
        firstVideoUrl: videos[0]?.videoUrl || null,
        totalVideos:   course.totalVideos,
        totalDuration: course.totalDuration,
        createdAt:     course.createdAt,
      },
      stats: { totalVideos, completedVideos, completionPercentage, totalWatchTime },
      videos: mergedVideos,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Fetch Single YouTube Video Duration ─────────────────────────────────────
const getYoutubeVideoDuration = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return next(new AppError("Video ID is required", 400));
    // Validate YouTube video ID format (11 alphanumeric + hyphen/underscore chars)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return next(new AppError("Invalid YouTube video ID format.", 400));
    }
    const durationMap = await fetchVideoDurations([videoId]);
    res.status(200).json({ duration: durationMap[videoId] || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createManualCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  addVideo,
  removeVideo,
  importYoutubeCourse,
  getCourseDetails,
  getYoutubeVideoDuration,
};