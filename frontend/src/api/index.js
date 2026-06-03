import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Inject JWT on every request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Unwrap error messages
api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(new Error(err.response?.data?.message || 'Something went wrong'))
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
  me:       ()     => api.get('/auth/me'),
};

// ─── Courses ──────────────────────────────────────────────────────────────────
export const coursesAPI = {
  list:          (page = 1, limit = 12) => api.get(`/courses?page=${page}&limit=${limit}`),
  getById:       (id)                   => api.get(`/courses/${id}`),
  getDetails:    (id)                   => api.get(`/courses/${id}/details`),
  createManual:  (body)                 => api.post('/courses/manual', body),
  createYoutube: (body)                 => api.post('/courses/youtube', body),
  update:        (id, body)             => api.patch(`/courses/${id}`, body),
  delete:        (id)                   => api.delete(`/courses/${id}`),
  addVideo:      (courseId, body)       => api.post(`/courses/${courseId}/videos`, body),
  removeVideo:   (courseId, videoId)    => api.delete(`/courses/${courseId}/videos/${videoId}`),
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const progressAPI = {
  update:     (videoId, watchedSeconds) => api.post('/progress', { videoId, watchedSeconds }),
  toggleStar: (videoId)                 => api.patch(`/progress/${videoId}/star`),
};

// ─── Notes ───────────────────────────────────────────────────────────────────
export const notesAPI = {
  get:    (videoId)          => api.get(`/notes/${videoId}`),
  save:   (videoId, content) => api.post('/notes', { videoId, content }),
  delete: (videoId)          => api.delete(`/notes/${videoId}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  heatmap: (range = '30d') => api.get(`/analytics/heatmap?range=${range}`),
  summary: ()              => api.get('/analytics/summary'),
};

// ─── Goals (Plan Your Day) ────────────────────────────────────────────────────
export const goalsAPI = {
  getToday:    ()           => api.get('/goals/today'),
  save:        (body)       => api.post('/goals', body),
  history:     (type, page) => api.get(`/goals/history?type=${type}&page=${page || 1}`),
  addTask:     (body)       => api.post('/goals/tasks', body),
  toggleTask:  (taskId)     => api.patch(`/goals/tasks/${taskId}`),
  deleteTask:  (taskId)     => api.delete(`/goals/tasks/${taskId}`),
};