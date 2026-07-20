const mongoose = require("mongoose");
const Note     = require("../models/Note");
const Video    = require("../models/Video");
const Course   = require("../models/Course");
const AppError = require("../utils/AppError");

/**
 * True when the video exists and its course belongs to the given user.
 * Notes are per-user but anchored to videos — without this check any
 * authenticated user could create notes against another user's videos.
 */
const _userOwnsVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId).select("courseId").lean();
  if (!video) return false;
  const course = await Course.findById(video.courseId).select("userId").lean();
  return !!course && course.userId.toString() === userId.toString();
};

// ─── Save Note (Create or Update) ────────────────────────────────────────────

/**
 * @route   POST /api/notes
 * @desc    Upsert a note for a specific video.
 *          If a note already exists for this (userId, videoId) pair it is
 *          updated in-place; otherwise a new document is created.
 *          Safe to call on every keystroke — designed for auto-save.
 * @access  Protected
 *
 * Body: {
 *   videoId : string   (required) — MongoDB ObjectId of the target video
 *   content : string   (required) — Note body; empty string is allowed
 * }
 */
const saveNote = async (req, res, next) => {
  try {
    const userId             = req.userId;
    const { videoId, content } = req.body;

    // ── 1. Validate required fields ───────────────────────────────────────────

    if (!videoId) {
      return next(new AppError("videoId is required.", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return next(new AppError("Invalid videoId.", 400));
    }

    if (content === undefined || content === null) {
      return next(new AppError("content is required (empty string is acceptable).", 400));
    }

    // ── 2. Confirm the video exists and belongs to this user ──────────────────
    // Prevents orphan notes and notes against other users' videos.

    if (!(await _userOwnsVideo(videoId, userId))) {
      return next(new AppError("Video not found.", 404));
    }

    // ── 3. Explicitly cast strings → ObjectId ─────────────────────────────────
    // req.userId arrives as a plain string from the JWT decode.
    // req.body.videoId is also a plain string.
    // The Note schema stores both as ObjectId. Mongoose's auto-cast is
    // unreliable for findOneAndUpdate upsert filters in Mongoose 8 —
    // the filter runs string-vs-ObjectId and silently matches nothing,
    // so the upsert creates a new doc instead of updating the existing one.
    // Explicit casting guarantees a correct ObjectId-vs-ObjectId comparison.

    const userObjId  = new mongoose.Types.ObjectId(userId);
    const videoObjId = new mongoose.Types.ObjectId(videoId);

    // ── 4. Upsert the note ────────────────────────────────────────────────────

    const note = await Note.findOneAndUpdate(
      { userId: userObjId, videoId: videoObjId }, // explicit ObjectId filter
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,   // create if it doesn't exist
        new: true,   // return the updated/created document
        runValidators: true,   // apply schema validators on update
        setDefaultsOnInsert: true,   // apply schema defaults on insert
      }
    );

    // ── 5. Respond ────────────────────────────────────────────────────────────

    res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
};

// ─── Get Note ─────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/notes/:videoId
 * @desc    Retrieve the authenticated user's note for a specific video.
 *          Returns { content: "" } when no note has been saved yet so the
 *          frontend editor always receives a predictable shape.
 * @access  Protected
 *
 * Params:
 *   videoId : string — MongoDB ObjectId of the target video
 */
const getNote = async (req, res, next) => {
  try {
    const userId      = req.userId;
    const { videoId } = req.params;

    // ── 1. Validate videoId format ────────────────────────────────────────────

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return next(new AppError("Invalid videoId.", 400));
    }

    // ── 2. Explicitly cast strings → ObjectId ─────────────────────────────────
    // Same casting requirement as saveNote — ensures the findOne filter
    // performs an ObjectId-vs-ObjectId comparison, not string-vs-ObjectId.

    const userObjId  = new mongoose.Types.ObjectId(userId);
    const videoObjId = new mongoose.Types.ObjectId(videoId);

    // ── 3. Look up the note ───────────────────────────────────────────────────

    const note = await Note.findOne({ userId: userObjId, videoId: videoObjId });

    // ── 4. Return empty content if no note exists yet ─────────────────────────
    // Keeps the frontend contract consistent — the editor never has to handle null.

    if (!note) {
      return res.status(200).json({
        note: {
          videoId,
          content:   "",
          updatedAt: null,
        },
      });
    }

    // ── 5. Respond ────────────────────────────────────────────────────────────

    res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
};


// ─── Delete Note ──────────────────────────────────────────────────────────────
 
/**
 * @route   DELETE /api/notes/:videoId
 * @desc    Permanently delete the user's note for a video.
 * @access  Protected
 */
const deleteNote = async (req, res, next) => {
  try {
    const userId      = req.userId;
    const { videoId } = req.params;
 
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return next(new AppError("Invalid videoId.", 400));
    }
 
    const userObjId  = new mongoose.Types.ObjectId(userId);
    const videoObjId = new mongoose.Types.ObjectId(videoId);
 
    const note = await Note.findOneAndDelete({ userId: userObjId, videoId: videoObjId });
 
    if (!note) {
      return next(new AppError("Note not found.", 404));
    }
 
    res.status(200).json({ message: "Note deleted successfully." });
  } catch (err) {
    next(err);
  }
};
 

module.exports = { saveNote, getNote, deleteNote };