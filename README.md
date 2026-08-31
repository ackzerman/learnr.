# learnr. 🎓

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Integration-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

> **Transform unstructured YouTube playlists and videos into structured, gamified learning courses with time-series activity tracking, dual-streak mechanics, auto-saving notes, and learning analytics.**

---

## 🌟 Key Features

### 📺 1. YouTube Import & Course Engine
* **One-Click Playlist Import:** Integrates with the YouTube Data API v3 to fetch entire playlists (with pagination for 50+ videos), extracting metadata, high-resolution thumbnails, titles, and ISO 8601 durations converted to exact seconds.
* **Manual Course Builder:** Build custom courses from scratch, mix external links, edit video details, and reorder playlists with bulk operations.
* **Course Search & Tag Taxonomy:** Full-text case-insensitive regex search across all enrolled courses and custom tags.

### 🎮 2. Video Player & Progress Engine
* **Interactive Player:** Embeds the YouTube IFrame API and native video players with synchronized playback tracking.
* **Smart Completion Engine:** Automatically marks lessons completed once 90% of duration is watched, with delta-second deduplication to prevent stat inflation.
* **Time-Linked Markdown Notes:** Built-in rich note editor per video with debounced auto-save (1.2s) and instant persistence.
* **Starring & Quick Navigation:** Bookmark important lessons and navigate through courses with resume-lesson shortcuts.

### 🔥 3. Dual-Streak Gamification System
To prevent stale database states, current streaks are **computed on the fly** from time-series logs, while all-time bests are persisted:
* **Goal Streak (Dashboard):** Tracks consecutive days of completing 100% of planned daily goal tasks.
* **Activity Streak (Profile):** Tracks consecutive days of active video watch time.
* **Monthly Streak Calendar:** Visual retro calendar grid displaying completed days and best streaks.

### 📅 4. Plan Your Day (Goal Management)
* **Daily & Weekly Goal Planner:** Create up to 20 daily and 30 weekly tasks with deep links directly to course videos.
* **Historical Retrospective:** Paginated history with performance badges (🏆 Perfect, 🔥 Great, ⚡ Good, etc.) and daily completion rates.

### 📊 5. Learning Analytics & Heatmaps
* **GitHub-Style Activity Heatmap:** 52-week rolling activity heatmap visualizing daily watch volume and consistency.
* **Breakdown Visualizations (Recharts):** Interactive Daily, Weekly, and Monthly charts showing both video counts and hours watched with automated date-gap filling.
* **Dashboard Aggregation:** Parallelized database queries with `Promise.all` to deliver continue-watching states, recent course progress, and stats in a single request.

### 👤 6. Profile & Media Management
* **Cloudinary Avatar Pipeline:** Direct memory-buffer image upload via Multer to Cloudinary with server-side facial recognition auto-cropping.
* **Secure Auth System:** JWT-based authentication with bcrypt password hashing (10 rounds) and centralized Axios interceptors.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router DOM v6, Recharts, Axios |
| **Styling** | Vanilla CSS (Neo-Brutalist / Pixel aesthetic with Space Grotesk & Space Mono typography) |
| **Backend** | Node.js, Express.js, Multer, Express Rate Limit |
| **Database** | MongoDB with Mongoose ODM |
| **External APIs** | YouTube Data API v3, Cloudinary API |
| **Security** | JSON Web Tokens (JWT), Bcrypt.js, CORS |

---

## 🏗️ Architecture & Database Design

```
                  ┌──────────────────────┐
                  │     React Client     │
                  │   (Vite + Recharts)  │
                  └──────────┬───────────┘
                             │ Axios + JWT
                             ▼
                  ┌──────────────────────┐
                  │    Express Server    │
                  │ (Controllers/Routes) │
                  └────┬───────┬───────┬─┘
                       │       │       │
       ┌───────────────┘       │       └───────────────┐
       ▼                       ▼                       ▼
┌──────────────┐      ┌────────────────┐      ┌─────────────────┐
│   MongoDB    │      │  YouTube API   │      │ Cloudinary API  │
│  (Mongoose)  │      │ (Playlist Data)│      │(Avatar Uploads) │
└──────────────┘      └────────────────┘      └─────────────────┘
```

### Core Data Models
* **`User`**: User credentials, handle, Cloudinary avatar IDs, and all-time `maxGoalStreak` / `maxActivityStreak`.
* **`Course`**: Container for curriculum, tags, source type (`youtube` | `manual`), and denormalized totals (`totalVideos`, `totalDuration`).
* **`Video`**: Individual lesson belonging to a course with duration, order index, and URLs.
* **`Progress`**: Compound indexed `(userId, videoId)` tracking `watchedSeconds`, `completed`, and `starred` state.
* **`DailyActivity`**: Time-series log `(userId, date)` recording `videosWatchedCount` and `totalWatchSeconds`.
* **`Goal` & `GoalCompletion`**: Daily and weekly task records with completion flags driving the streak engine.
* **`Note`**: Auto-saved user notes per video with custom timestamps.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** or **yarn**
* **MongoDB** instance (local or MongoDB Atlas connection URI)
* **YouTube Data v3 API Key** (from [Google Cloud Console](https://console.cloud.google.com/))
* **Cloudinary Account** (for profile picture uploads)

---

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/learnr.git
cd learnr
```

### 2. Backend Setup
Navigate to the `backend` directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in `/backend` using the example template:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/learnr?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
CORS_ORIGIN=http://localhost:5173

# YouTube API
YOUTUBE_API_KEY=your_google_youtube_api_key

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend server:
```bash
# Production mode
npm start

# Development mode (with nodemon)
npm run dev
```
The server will start at `http://localhost:5000`.

---

### 3. Frontend Setup
Open a new terminal, navigate to the `frontend` directory, and install dependencies:
```bash
cd ../frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The client app will be accessible at `http://localhost:5173`.

---

## 📡 API Endpoints Overview

### Auth (`/api/auth`)
* `POST /register` – Register user and generate JWT
* `POST /login` – Authenticate credentials and return JWT
* `GET /me` – Retrieve authenticated user profile

### Courses (`/api/courses`)
* `GET /` – Get all courses with tag filtering, search, and pagination
* `POST /youtube` – Import course from a YouTube playlist URL
* `POST /manual` – Create a custom course manually
* `GET /:id/details` – Retrieve full course details with merged user progress and notes
* `PATCH /:id/videos/reorder` – Reorder playlist video sequence
* `DELETE /:id` – Delete course with cascading progress/notes cleanup

### Progress & Activity (`/api/progress`)
* `POST /` – Record video watched seconds (updates daily activity & progress)
* `PATCH /:videoId/star` – Toggle starred state for a lesson

### Goals & Streaks (`/api/goals`, `/api/streak`)
* `GET /api/goals/today` – Fetch or initialize today's daily goal
* `POST /api/goals/tasks` – Append task to goal
* `PATCH /api/goals/tasks/:taskId` – Toggle task completion (syncs streak)
* `GET /api/streak` – Get 7-day strip or full-month calendar streak completion data

### User & Analytics (`/api/users`)
* `PUT /profile` – Update user display name and handle
* `PUT /profile/image` – Upload/replace avatar via Cloudinary
* `GET /analytics/heatmap` – Rolling activity heatmap data (30d / 90d / year)
* `GET /analytics/summary` – Aggregated Daily, Weekly, and Monthly breakdown
* `GET /activity-streak` – On-the-fly calculated video watch streak

---

## 📂 Project Structure

```
learnr/
├── backend/
│   ├── config/             # DB & Cloudinary configurations
│   ├── controllers/        # Request handlers & aggregation pipelines
│   ├── middleware/         # Auth verification, upload, error handlers
│   ├── models/             # Mongoose schemas (User, Course, Video, etc.)
│   ├── routes/             # Express API route declarations
│   ├── utils/              # Date helpers, YouTube API wrapper, tokens
│   └── server.js           # Express app entry point
│
├── frontend/
│   ├── public/             # Static public assets
│   ├── src/
│   │   ├── api/            # Centralized Axios client & API endpoints
│   │   ├── components/     # UI design system, Navbar, StreakCalendar
│   │   ├── hooks/          # Custom React hooks (useAuth, useToast)
│   │   ├── pages/          # Dashboard, Courses, VideoPlayer, PlanYourDay, Profile
│   │   ├── utils/          # Formatting helpers, YouTube thumbnail extractors
│   │   ├── App.jsx         # App routes and layout providers
│   │   ├── index.css       # Design tokens, variables & typography
│   │   └── main.jsx        # React root entry
│   └── vite.config.js      # Vite build configuration & proxy
│
└── README.md               # Project documentation
```

---

## 🔒 Security Best Practices Implemented
* **Rate Limiting:** Auth endpoint protection against brute force via `express-rate-limit`.
* **Payload Protection:** JSON payload size limits configured on incoming request bodies.
* **Password Hashing:** Passwords salted and hashed with `bcryptjs`.
* **Database Sanitization:** Mongoose query casting and regex escaping on all search filters to prevent NoSQL injection and ReDoS attacks.
* **Ownership Verification:** Cascading checks ensuring users can only read, modify, or delete their own courses, notes, and progress records.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).