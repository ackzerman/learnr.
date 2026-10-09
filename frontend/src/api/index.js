import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

// ─── In-memory access token (never localStorage) ─────────────────────────
let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (t) => { accessToken = t || null; };
export const getAccessToken = () => accessToken;

const isAuthEndpoint = (url = '') =>
  url.includes('/auth/login') || url.includes('/auth/register') ||
  url.includes('/auth/refresh') || url.includes('/auth/logout');

async function doRefresh() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then((d) => {
        setAccessToken(d.accessToken || d.token || null);
        return d;
      })
      .catch((e) => {
        setAccessToken(null);
        throw e;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export const refreshSession = () => doRefresh();

// Inject JWT and client timezone on every request
api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  // Send client timezone offset so the server can compute dates in the user's
  // local timezone instead of the server's clock.  getTimezoneOffset() returns
  // minutes *ahead* of UTC (negative for east-of-UTC), e.g. -330 for IST.
  cfg.headers['X-Timezone-Offset'] = new Date().getTimezoneOffset().toString();
  return cfg;
});

// Single-flight refresh: concurrent 401s share one refresh, retry once max.
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const original = err.config || {};
    const status = err.response?.status;
    if (status === 401 && !original._retried && !isAuthEndpoint(original.url || '')) {
      original._retried = true;
      try {
        const d = await doRefresh();
        if (d.accessToken || d.token) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${d.accessToken || d.token}`;
        }
        return api(original);
      } catch (e) {
        // Refresh failed — clear state; callers/route guards redirect to login.
      }
    }
    return Promise.reject(new Error(err.response?.data?.message || 'Something went wrong'));
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  googleStart: () => { window.location.href = '/api/auth/google'; },
};

// ─── Courses ──────────────────────────────────────────────────────────────────
export const coursesAPI = {
  list: (page = 1, limit = 12, { tags = [], search = '' } = {}) => {
    let q = `/courses?page=${page}&limit=${limit}`;
    if (tags.length) q += `&tags=${encodeURIComponent(tags.join(','))}`;
    if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
    return api.get(q);
  },
  getById: (id) => api.get(`/courses/${id}`),
  getDetails: (id) => api.get(`/courses/${id}/details`),
  createManual: (body) => api.post('/courses/manual', body),
  createYoutube: (body) => api.post('/courses/youtube', body),
  update: (id, body) => api.patch(`/courses/${id}`, body),
  delete: (id) => api.delete(`/courses/${id}`),
  addVideo: (courseId, body) => api.post(`/courses/${courseId}/videos`, body),
  updateVideo: (courseId, videoId, body) => api.patch(`/courses/${courseId}/videos/${videoId}`, body),
  removeVideo: (courseId, videoId) => api.delete(`/courses/${courseId}/videos/${videoId}`),
  reorderVideos: (courseId, videoIds) => api.patch(`/courses/${courseId}/videos/reorder`, { videoIds }),
  getYoutubeDuration: (videoId) => api.get(`/courses/youtube/duration/${videoId}`),
  searchVideos: (query) => api.get(`/courses/search/videos?q=${encodeURIComponent(query)}`),
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const progressAPI = {
  update: (videoId, watchedSeconds) => api.post('/progress', { videoId, watchedSeconds }),
  toggleStar: (videoId) => api.patch(`/progress/${videoId}/star`),
};

// ─── Notes ───────────────────────────────────────────────────────────────────
export const notesAPI = {
  get: (videoId) => api.get(`/notes/${videoId}`),
  save: (videoId, content) => api.post('/notes', { videoId, content }),
  delete: (videoId) => api.delete(`/notes/${videoId}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};



// ─── Goals (Plan Your Day) ────────────────────────────────────────────────────
export const goalsAPI = {
  getToday: () => api.get('/goals/today'),
  getByDate: (date) => api.get(`/goals/date/${date}`),
  save: (body) => api.post('/goals', body),
  history: (type, page) => api.get(`/goals/history?type=${type}&page=${page || 1}`),
  addTask: (body) => api.post('/goals/tasks', body),
  toggleTask: (taskId, date) => api.patch(`/goals/tasks/${taskId}${date ? `?date=${date}` : ''}`),
  deleteTask: (taskId, date) => api.delete(`/goals/tasks/${taskId}${date ? `?date=${date}` : ''}`),
  // Weekly — optional `week` param is a Monday date (YYYY-MM-DD)
  getWeekly: (week) => api.get(`/goals/weekly${week ? `?week=${week}` : ''}`),
  addWeeklyTask: (body, week) => api.post(`/goals/weekly/tasks${week ? `?week=${week}` : ''}`, body),
  toggleWeeklyTask: (taskId, week) => api.patch(`/goals/weekly/tasks/${taskId}${week ? `?week=${week}` : ''}`),
  deleteWeeklyTask: (taskId, week) => api.delete(`/goals/weekly/tasks/${taskId}${week ? `?week=${week}` : ''}`),
};

// ─── Streak ───────────────────────────────────────────────────────────────────
export const streakAPI = {
  get: (month) => api.get(month ? `/streak?month=${month}` : '/streak'),
};

// ─── User Profile ─────────────────────────────────────────────────────────────
export const userAPI = {
  updateProfile: (body) => api.put('/users/profile', body),
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('profileImage', file);
    return api.put('/users/profile/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeImage: () => api.delete('/users/profile/image'),
  // Analytics
  heatmap: (range = '30d') => api.get(`/users/analytics/heatmap?range=${range}`),
  heatmapByYear: (year) => api.get(`/users/analytics/heatmap?year=${year}`),
  heatmapYears: () => api.get('/users/analytics/heatmap/years'),
  summary: () => api.get('/users/analytics/summary'),
  // Activity Streak (video watching)
  activityStreak: () => api.get('/users/activity-streak'),
};

export default api;
