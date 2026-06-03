import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { coursesAPI, progressAPI } from '../api';
import { fmt, pct, fmtDate, parseTags, ytThumb } from '../utils';
import {
  Spinner, ErrBox, ProgressBar, Modal, LabelInput,
  CourseBadge, VideoCircle, EmptyState, TagEditor,
} from '../components/UI';
import { useToast } from '../hooks/useToast';

/* ─── Add video form ─────────────────────────────────────────────────────── */
function AddVideoForm({ courseId, onDone }) {
  const [form, setForm] = useState({ title: '', duration: '', videoUrl: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await coursesAPI.addVideo(courseId, { title: form.title, duration: parseInt(form.duration), videoUrl: form.videoUrl });
      toast('Video added ✓');
      onDone();
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LabelInput label="Title" placeholder="Video title" value={form.title} onChange={F('title')} required />
      <LabelInput label="Duration (seconds)" type="number" min="1" placeholder="e.g. 600 for 10 min" value={form.duration} onChange={F('duration')} required hint="Convert minutes × 60" />
      <LabelInput label="Video URL (optional)" type="url" placeholder="https://..." value={form.videoUrl} onChange={F('videoUrl')} />
      <ErrBox msg={err} />
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'ADD VIDEO'}</button>
    </form>
  );
}

/* ─── Course detail ──────────────────────────────────────────────────────── */
export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [showAddVideo, setShowAddVideo] = useState(false);

  // Track starred state locally so toggling is instant without a full reload
  const [starredMap, setStarredMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await coursesAPI.getDetails(id);
      setData(d);
      setEditTitle(d.course.title);
      setEditTags(d.course.tags?.join(', ') || '');
      // Seed the local starred map from the API response
      const map = {};
      d.videos.forEach((v) => { map[v.videoId] = v.progress?.starred ?? false; });
      setStarredMap(map);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [id]);

  const toggleStar = async (videoId) => {
    // Optimistic update — flip immediately so UI feels instant
    setStarredMap((prev) => ({ ...prev, [videoId]: !prev[videoId] }));
    try {
      const res = await progressAPI.toggleStar(videoId);
      // Sync with server's authoritative value
      setStarredMap((prev) => ({ ...prev, [videoId]: res.starred }));
    } catch (e) {
      // Revert on failure
      setStarredMap((prev) => ({ ...prev, [videoId]: !prev[videoId] }));
      toast(e.message, 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const saveEdit = async () => {
    try {
      await coursesAPI.update(id, { title: editTitle, tags: parseTags(editTags) });
      toast('Course updated ✓');
      setEditMode(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const deleteCourse = async () => {
    if (!confirm('Delete this course and ALL its data? This cannot be undone.')) return;
    try {
      await coursesAPI.delete(id);
      toast('Course deleted');
      navigate('/courses');
    } catch (e) { toast(e.message, 'error'); }
  };

  const deleteVideo = async (videoId, videoTitle) => {
    if (!confirm(`Remove "${videoTitle}"?`)) return;
    try {
      await coursesAPI.removeVideo(id, videoId);
      toast('Video removed');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <Spinner pad={80} />;
  if (!data) return <p style={{ color: '#747879', textAlign: 'center', padding: 60 }}>Course not found.</p>;

  const { course, stats, videos } = data;
  const isYT = course.source === 'youtube';

  return (
    <div className="page-wrapper fade-up" style={{ maxWidth: 1000 }}>
      <button className="btn-ghost" style={{ marginBottom: 20, fontSize: 13 }} onClick={() => navigate('/courses')}>
        ← Back to courses
      </button>

      {/* Course header card — hero style */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden', boxShadow: '6px 6px 0px 0px #181f21', borderWidth: '4px' }}>
        {/* Optional decorative corner */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, opacity: 0.08, background: '#181f21', transform: 'rotate(45deg) translate(30px, -30px)' }} />
        </div>

        <div style={{ padding: 32 }}>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LabelInput label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <LabelInput label="Tags (comma-separated)" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={saveEdit}>Save changes</button>
                <button className="btn-ghost" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {/* Top row: badge + links */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <CourseBadge source={course.source} />
                {course.playlistUrl && (
                  <a href={course.playlistUrl} target="_blank" rel="noopener noreferrer"
                    className="label-caps" style={{ color: '#003365', textDecoration: 'none', borderBottom: '2px solid #003365', paddingBottom: 1 }}>
                    View playlist ↗
                  </a>
                )}
              </div>

              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 36, fontWeight: 700, color: '#181f21',
                margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.1,
              }}>
                {course.title}
              </h1>

              {/* Enhanced metadata row with icons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#181f21' }}>video_library</span>
                  <span className="label-caps">Total Videos: {stats.totalVideos}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#181f21' }}>schedule</span>
                  <span className="label-caps">Duration: {fmt(course.totalDuration)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#747879' }}>calendar_today</span>
                  <span className="label-caps">Created: {fmtDate(course.createdAt)}</span>
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginTop: 4 }}>
                <TagEditor
                  tags={course.tags || []}
                  onUpdate={async (newTags) => {
                    try {
                      await coursesAPI.update(id, { tags: newTags });
                      setData((prev) => ({
                        ...prev,
                        course: { ...prev.course, tags: newTags },
                      }));
                      toast('Tags updated ✓');
                    } catch (e) { toast(e.message, 'error'); }
                  }}
                />
              </div>

              {/* Overall progress */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="label-caps" style={{ color: '#747879' }}>Progress</span>
                  <span className="label-caps" style={{ color: '#181f21' }}>{stats.completionPercentage}%</span>
                </div>
                <ProgressBar value={stats.completionPercentage} color={stats.completionPercentage === 100 ? '#536348' : '#536348'} height={8} />
              </div>

              {/* Action Buttons — Stitch-accurate, bottom of hero */}
              <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    background: '#fbfaee', color: '#181f21',
                    border: '4px solid #181f21', padding: '12px 24px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '4px 4px 0px 0px #181f21',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#d0e3c1'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fbfaee'}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(4px, 4px)'; e.currentTarget.style.boxShadow = 'none'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0px 0px #181f21'; }}
                >
                  Edit Course
                </button>
                <button
                  onClick={deleteCourse}
                  style={{
                    background: '#ba1a1a', color: '#ffffff',
                    border: '4px solid #181f21', padding: '12px 24px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '4px 4px 0px 0px #181f21',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(4px, 4px)'; e.currentTarget.style.boxShadow = 'none'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0px 0px #181f21'; }}
                >
                  Delete Course
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bento stat cards */}
      <div className="grid-bento" style={{ marginTop: 40 }}>
        <div className="bento-card" style={{ background: '#003365' }}>
          <span className="label-caps" style={{ color: '#fbfaee', opacity: 0.8 }}>Videos Done</span>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700,
            color: '#fbfaee', letterSpacing: '-0.02em',
          }}>{stats.completedVideos}/{stats.totalVideos}</span>
        </div>
        <div className="bento-card" style={{ background: '#d0e3c1' }}>
          <span className="label-caps" style={{ color: '#3c4b32' }}>Watch Time</span>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700,
            color: '#3c4b32', letterSpacing: '-0.02em',
          }}>{fmt(stats.totalWatchTime)}</span>
        </div>

      </div>

      {showAddVideo && (
        <Modal title="Add Video" onClose={() => setShowAddVideo(false)}>
          <AddVideoForm courseId={id} onDone={() => { setShowAddVideo(false); load(); }} />
        </Modal>
      )}

      {/* Video list header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 64, marginBottom: 16 }}>
        <div style={{ width: 4, height: 28, background: '#181f21' }} />
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 600, color: '#181f21', margin: 0 }}>
          Course Content
        </h2>
        {!isYT && (
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setShowAddVideo(true)}>+ Add video</button>
        )}
      </div>

      {videos.length === 0 ? (
        <EmptyState icon="🎬" title="No videos" sub={isYT ? 'No videos found in this playlist.' : 'Add your first video to get started.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {videos.map((v, i) => {
            const wp = pct(v.progress.watchedSeconds, v.duration);
            const isComplete = v.progress.completed;
            const statusColor = isComplete ? '#536348' : wp > 0 ? '#181f21' : '#747879';
            const statusText = isComplete ? 'WATCHED' : wp > 0 ? `IN PROGRESS (${wp}%)` : 'UNWATCHED';

            return (
              <div key={v.videoId} className="card card-sm" style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                opacity: !isComplete && wp === 0 ? 0.75 : 1,
              }}>
                {/* Index number square */}
                <div style={{
                  width: 40, height: 40, flexShrink: 0,
                  background: isComplete ? '#181f21' : wp > 0 ? '#efeee3' : 'transparent',
                  border: isComplete ? '2px solid #181f21' : '2px solid #181f21',
                  borderStyle: !isComplete && wp === 0 ? 'dashed' : 'solid',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700,
                  color: isComplete ? '#fbfaee' : '#181f21',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Video thumbnail */}
                {(() => {
                  const vThumb = ytThumb(v.thumbnailUrl, v.videoUrl);
                  return vThumb ? (
                    <div style={{ width: 120, aspectRatio: '16/9', flexShrink: 0, border: '4px solid #181f21', overflow: 'hidden' }}>
                      <img src={vThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    </div>
                  ) : null;
                })()}

                {/* Info — click to watch */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/courses/${id}/watch/${v.videoId}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: '#181f21', fontSize: 16, fontWeight: 600, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {v.title}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {isComplete && <span className="material-symbols-outlined" style={{ color: '#536348', fontSize: 20 }}>check_circle</span>}
                      {starredMap[v.videoId] && <span className="material-symbols-outlined" style={{ color: '#003365', fontSize: 20 }}>star</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="label-caps" style={{ color: '#747879', fontSize: 10 }}>Duration: {fmt(v.duration)}</span>
                    <span className="label-caps" style={{ color: statusColor, fontSize: 10 }}>Status: {statusText}</span>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ marginTop: 8 }}>
                    <ProgressBar value={wp} color="#536348" height={6} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  {/* Star button */}
                  <button
                    onClick={() => toggleStar(v.videoId)}
                    title={starredMap[v.videoId] ? 'Unstar video' : 'Star as important'}
                    style={{
                      background: 'transparent',
                      border: '2px solid #181f21',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: '6px 8px',
                      color: starredMap[v.videoId] ? '#003365' : '#c3c7c8',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!starredMap[v.videoId]) e.currentTarget.style.color = '#536348'; }}
                    onMouseLeave={(e) => { if (!starredMap[v.videoId]) e.currentTarget.style.color = '#c3c7c8'; }}
                  >
                    {starredMap[v.videoId] ? '★' : '☆'}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => navigate(`/courses/${id}/watch/${v.videoId}`)}
                  >
                    {isComplete ? 'Rewatch' : wp > 0 ? 'Resume' : 'Watch'}
                  </button>
                  {!isYT && (
                    <button className="btn-danger" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => deleteVideo(v.videoId, v.title)}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}