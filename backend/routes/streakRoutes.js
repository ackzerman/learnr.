const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getStreak } = require("../controllers/streakController");

// All streak routes require authentication
router.use(protect);

router.get("/", getStreak);

module.exports = router;
