# learnr. — Frontend

React + Vite frontend for the learnr. learning tracker backend.

## Quick start

```bash
npm install
npm run dev
```

App runs on **http://localhost:3000** and proxies `/api/*` to `http://localhost:5000`.

## Stack

| Layer       | Choice                |
|-------------|-----------------------|
| Framework   | React 18              |
| Routing     | React Router v6       |
| HTTP        | Axios (auto-JWT)      |
| Charts      | Recharts              |
| Build tool  | Vite                  |
| Fonts       | DM Sans + DM Mono     |

## File structure

```
src/
  api/          – All backend calls (auth, courses, progress, notes, dashboard, analytics)
  components/   – Shared UI primitives (cards, modals, heatmap, progress bar, etc.)
  hooks/        – useAuth (JWT context) · useToast (global toast system)
  pages/        – One file per page
  utils/        – fmt, pct, fmtDate, ytVideoId, parseTags
  App.jsx       – Router + protected layout
  main.jsx      – Entry point
  index.css     – Design tokens + global styles
```

## Pages & routes

| Route                              | Page          | Backend calls                              |
|------------------------------------|---------------|--------------------------------------------|
| `/login`                           | Login         | POST /api/auth/login                       |
| `/register`                        | Register      | POST /api/auth/register                    |
| `/`                                | Dashboard     | GET /api/dashboard                         |
| `/courses`                         | Courses       | GET /api/courses, POST /manual or /youtube |
| `/courses/:id`                     | CourseDetail  | GET /api/courses/:id/details, PATCH, DELETE |
| `/courses/:courseId/watch/:videoId`| VideoPlayer   | GET details, POST /progress, GET+POST /notes |
| `/analytics`                       | Analytics     | GET /api/analytics/heatmap + /summary      |
| `/profile`                         | Profile       | GET /api/auth/me                           |

## Environment

Make sure your backend `.env` has the correct `MONGO_URI`, `JWT_SECRET`, and `YOUTUBE_API_KEY`.

The Vite proxy (`vite.config.js`) handles the `/api` prefix — no CORS config needed in dev.
