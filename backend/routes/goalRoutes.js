const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getToday,
  saveGoal,
  addTask,
  toggleTask,
  deleteTask,
  getHistory,
} = require("../controllers/goalController");

// All goal routes require authentication
router.use(protect);

router.get("/today", getToday);
router.post("/", saveGoal);
router.get("/history", getHistory);
router.post("/tasks", addTask);
router.patch("/tasks/:taskId", toggleTask);
router.delete("/tasks/:taskId", deleteTask);

module.exports = router;
