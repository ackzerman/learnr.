const express = require("express");
const router  = express.Router();

const { getHeatmap, getHeatmapYears, getSummary } = require("../controllers/analyticsController");
const { protect }                = require("../middleware/authMiddleware");

/**
 * Analytics Routes
 * Base path: /api/analytics  (mounted in server.js)
 * All routes are protected — a valid JWT is required.
 */

// Apply protect to every route in this file
router.use(protect);

// @route  GET /api/analytics/heatmap/years
router.get("/heatmap/years", getHeatmapYears);

// @route  GET /api/analytics/heatmap?range=30d|90d|year|all&year=YYYY
router.get("/heatmap", getHeatmap);

// @route  GET /api/analytics/summary
router.get("/summary", getSummary);

module.exports = router;
