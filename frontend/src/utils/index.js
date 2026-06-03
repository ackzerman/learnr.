/** Format seconds → "1h 30m", "45m", "30s" */
export const fmt = (s) => {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
};

/** Watched / duration → 0–100 */
export const pct = (watched, duration) =>
  duration > 0 ? Math.min(100, Math.round((watched / duration) * 100)) : 0;

/** Format date string */
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

/** Extract YouTube video ID from URL */
export const ytVideoId = (url) => {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').pop();
  } catch {
    return null;
  }
};

/** Parse comma-separated tags string → trimmed array */
export const parseTags = (str) =>
  str.split(',').map((t) => t.trim()).filter(Boolean);

/**
 * Derive a YouTube thumbnail URL.
 * Priority: stored thumbnailUrl → derive from videoUrl → null
 */
export const ytThumb = (thumbnailUrl, videoUrl) => {
  if (thumbnailUrl) return thumbnailUrl;
  const id = ytVideoId(videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
};

