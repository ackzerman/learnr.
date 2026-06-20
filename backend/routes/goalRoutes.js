const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getToday,
  getByDate,
  saveGoal,
  addTask,
  toggleTask,
  deleteTask,
  getHistory,
  getWeekly,
  addWeeklyTask,
  toggleWeeklyTask,
  deleteWeeklyTask,
} = require("../controllers/goalController");

// All goal routes require authentication
router.use(protect);

// Daily goals
router.get("/today", getToday);
router.get("/date/:date", getByDate);
router.post("/", saveGoal);
router.get("/history", getHistory);
router.post("/tasks", addTask);
router.patch("/tasks/:taskId", toggleTask);
router.delete("/tasks/:taskId", deleteTask);

// Weekly goals
router.get("/weekly", getWeekly);
router.post("/weekly/tasks", addWeeklyTask);
router.patch("/weekly/tasks/:taskId", toggleWeeklyTask);
router.delete("/weekly/tasks/:taskId", deleteWeeklyTask);

module.exports = router;
