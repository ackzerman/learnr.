const express = require("express");
const router = express.Router();

const {
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
} = require("../controllers/courseController");

const { protect } = require("../middleware/authMiddleware");

/**
 * Course Routes
 * Base path: /api/courses  (mounted in server.js)
 * All routes are protected — a valid JWT is required for every request.
 */

// Apply protect middleware to every route in this file
router.use(protect);

// @route  POST /api/courses/manual  — Create a manual course with videos
router.post("/manual", createManualCourse);

// @route  GET  /api/courses         — Get all courses for the logged-in user
router.get("/", getCourses);

// @route  POST /api/courses/youtube  — Import a course from a YouTube playlist
router.post("/youtube", importYoutubeCourse);

// @route  GET  /api/courses/youtube/duration/:videoId — Get single video duration
router.get("/youtube/duration/:videoId", getYoutubeVideoDuration);

// @route  GET  /api/courses/:id/details — Full course detail with progress + notes
router.get("/:id/details", getCourseDetails);

// @route  GET  /api/courses/:id     — Get a single course with its videos
router.get("/:id", getCourseById);

// @route  PATCH /api/courses/:id          — Update title and/or tags
router.patch("/:id", updateCourse);
 
// @route  DELETE /api/courses/:id         — Delete course + cascade
router.delete("/:id", deleteCourse);
 
// ── Video Management (manual courses only) ────────────────────────────────────
 
// @route  POST   /api/courses/:id/videos            — Add a video
router.post("/:id/videos", addVideo);
 
// @route  DELETE /api/courses/:id/videos/:videoId   — Remove a video
router.delete("/:id/videos/:videoId", removeVideo);

module.exports = router;