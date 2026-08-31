const express = require("express");
const router = express.Router();

const {
  updateProfile, updateProfileImage, removeProfileImage,
  getHeatmap, getHeatmapYears, getSummary, getActivityStreak
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

/**
 * User Routes
 * Base path: /api/users  (mounted in server.js)
 */

// @route  PUT  /api/users/profile       — Update name & username
router.put("/profile", protect, updateProfile);

// @route  PUT  /api/users/profile/image  — Upload / replace profile image
router.put("/profile/image", protect, upload.single("profileImage"), updateProfileImage);

// @route  DELETE /api/users/profile/image — Remove profile image
router.delete("/profile/image", protect, removeProfileImage);

// ─── Analytics ───────────────────────────────────────────────────────────────

// @route  GET /api/users/analytics/heatmap/years
router.get("/analytics/heatmap/years", protect, getHeatmapYears);

// @route  GET /api/users/analytics/heatmap
router.get("/analytics/heatmap", protect, getHeatmap);

// @route  GET /api/users/analytics/summary
router.get("/analytics/summary", protect, getSummary);

// ─── Activity Streak ────────────────────────────────────────────────────────

// @route  GET /api/users/activity-streak — Current + max video watching streak
router.get("/activity-streak", protect, getActivityStreak);

module.exports = router;
