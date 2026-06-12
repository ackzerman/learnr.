// Load environment variables from .env file before anything else
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const healthRoute = require("./routes/healthRoute");
const authRoutes   = require("./routes/authRoutes");     // ← Auth: register / login / me
const courseRoutes = require("./routes/courseRoutes");   // ← Courses: create / list / detail
const progressRoutes = require("./routes/progressRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes"); 
const analyticsRoutes  = require("./routes/analyticsRoutes");   
const notesRoutes  = require("./routes/notesRoutes");     // ← Notes: save + fetch per video 
const goalRoutes   = require("./routes/goalRoutes");      // ← Goals: daily/weekly + tasks
const streakRoutes = require("./routes/streakRoutes");    // ← Streak: calendar streak data
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

// ─── App Initialisation ───────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Connect to Database ──────────────────────────────────────────────────────

connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Parse incoming JSON request bodies (limit payload size to prevent DoS)
app.use(express.json({ limit: '1mb' }));

// Enable Cross-Origin Resource Sharing — restricted to frontend origin
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiter for auth endpoints — prevents brute-force and credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 20,                   // max 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/health", healthRoute);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/courses", courseRoutes);   
app.use("/api/progress", progressRoutes);  
app.use("/api/dashboard", dashboardRoutes); 
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/streak", streakRoutes);

// Add future route modules here, e.g.:
// app.use("/api/users",    require("./routes/userRoutes"));
// app.use("/api/products", require("./routes/productRoutes"));

// ─── Error Handling ───────────────────────────────────────────────────────────

// Catch-all for undefined routes (must come after all valid routes)
app.use(notFound);

// Global error handler (must be last and have 4 parameters)
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
