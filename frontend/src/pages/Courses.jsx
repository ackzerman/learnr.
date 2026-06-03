import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesAPI } from '../api';
import { fmt, parseTags, ytThumb } from '../utils';
import { Spinner, ErrBox, ProgressBar, Modal, LabelInput, CourseBadge, EmptyState } from '../components/UI';
import { useToast } from '../hooks/useToast';

/* ─── Course card ────────────────────────────────────────────────────────── */
function CourseCard({ course, onClick }) {
  const cp = course.totalVideos > 0
    ? Math.round(((course.completedVideos || 0) / course.totalVideos) * 100)
    : 0;

  const thumb = ytThumb(course.thumbnailUrl, course.firstVideoUrl);

  return (
    <div className="card card-hover" onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 0, overflow: 'hidden' }}>
      {/* Thumbnail */}
      {thumb ? (
        <img src={thumb} alt="" className="thumb-course" loading="lazy" />
      ) : (
        <div className="thumb-course thumb-placeholder">🎬</div>
      )}

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <CourseBadge source={course.source} />
          {cp === 100 && <span className="label-caps" style={{ color: '#536348' }}>✓ Complete</span>}
        </div>

        <h3 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          color: '#181f21', fontSize: 16, fontWeight: 700, lineHeight: 1.3, margin: 0,
        }}>
          {course.title}
        </h3>

        {course.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {course.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}

        <p className="label-caps" style={{ color: '#747879', margin: 0, fontSize: 10 }}>
          {course.totalVideos} videos · {fmt(course.totalDuration)}
        </p>

        <div>
          <ProgressBar value={cp} color={cp === 100 ? '#536348' : '#536348'} />
          <p className="label-caps" style={{ color: '#c3c7c8', fontSize: 10, marginTop: 4, textAlign: 'right' }}>{cp}% complete</p>
        </div>
      </div>
    </div>
  );
}

/* ─── YouTube form ───────────────────────────────────────────────────────── */
function YouTubeForm({ onDone }) {
  const [url, setUrl]   = useState('');
  const [tags, setTags] = useState('');
  const [err, setErr]   = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await coursesAPI.createYoutube({ playlistUrl: url, tags: parseTags(tags) });
      toast('Course imported! ✓');
      onDone();
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LabelInput
        label="YouTube Playlist URL"
        type="url"
        placeholder="https://www.youtube.com/playlist?list=..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        hint="We'll automatically fetch all videos, titles, and durations."
      />
      <LabelInput
        label="Tags (optional, comma-separated)"
        placeholder="math, calculus, beginner"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <ErrBox msg={err} />
      {busy && <p style={{ color: '#747879', fontSize: 13 }}>⏳ Fetching from YouTube… large playlists may take a moment.</p>}
      <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'IMPORTING PLAYLIST…' : 'IMPORT PLAYLIST'}
      </button>
    </form>
  );
}

/* ─── Manual form ────────────────────────────────────────────────────────── */
function ManualForm({ onDone }) {
  const [title, setTitle] = useState('');
  const [tags,  setTags]  = useState('');
  const [videos, setVideos] = useState([{ title: '', duration: '', videoUrl: '' }]);
  const [err, setErr]   = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const addV    = () => setVideos((v) => [...v, { title: '', duration: '', videoUrl: '' }]);
  const removeV = (i) => setVideos((v) => v.filter((_, j) => j !== i));
  const updV    = (i, k, val) => setVideos((v) => v.map((vv, j) => j === i ? { ...vv, [k]: val } : vv));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await coursesAPI.createManual({
        title,
        tags: parseTags(tags),
        videos: videos.map((v) => ({
          title:    v.title,
          duration: parseInt(v.duration) || 0,
          videoUrl: v.videoUrl || '',
        })),
      });
      toast('Course created! ✓');
      onDone();
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LabelInput label="Course Title" placeholder="e.g. Linear Algebra Fundamentals" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <LabelInput label="Tags (comma-separated)" placeholder="math, algebra, intermediate" value={tags} onChange={(e) => setTags(e.target.value)} />

      {/* Video list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="label" style={{ margin: 0 }}>Videos ({videos.length})</label>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={addV}>+ Add video</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
          {videos.map((v, i) => (
            <div key={i} style={{ background: '#f5f4e8', border: '2px solid #181f21', padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  className="input" style={{ flex: 3 }} placeholder={`Video ${i + 1} title`}
                  value={v.title} onChange={(e) => updV(i, 'title', e.target.value)} required
                />
                <input
                  className="input" style={{ flex: 1 }} placeholder="Sec" type="number" min="1"
                  value={v.duration} onChange={(e) => updV(i, 'duration', e.target.value)} required
                  title="Duration in seconds"
                />
                {videos.length > 1 && (
                  <button type="button" className="btn-danger" style={{ padding: '8px 11px', flexShrink: 0 }} onClick={() => removeV(i)}>✕</button>
                )}
              </div>
              <input
                className="input" placeholder="Video URL (optional)"
                value={v.videoUrl} onChange={(e) => updV(i, 'videoUrl', e.target.value)}
              />
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#747879', marginTop: 6, fontFamily: "'Space Mono', monospace" }}>Duration in seconds — e.g. 600 = 10 minutes</p>
      </div>

      <ErrBox msg={err} />
      <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'CREATING…' : 'CREATE COURSE'}
      </button>
    </form>
  );
}

/* ─── Courses page ───────────────────────────────────────────────────────── */
export default function Courses() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [courses, setCourses]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [tab, setTab]               = useState('youtube');
  const [filterTags, setFilterTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const d = await coursesAPI.list(pg, 12);
      setCourses(d.courses);
      setPagination(d.pagination);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  // Collect all unique tags from loaded courses
  const allTags = useMemo(() => {
    const set = new Set();
    courses.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [courses]);

  // Toggle a tag in the active filter list
  const toggleTag = useCallback((tag) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Filter courses based on active tag filters and search query
  const filteredCourses = useMemo(() => {
    let result = courses;
    if (filterTags.length > 0) {
      result = result.filter((c) =>
        filterTags.every((ft) => (c.tags || []).includes(ft))
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        c.title.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, filterTags, searchQuery]);

  return (
    <div className="page-wrapper fade-up">
      {/* Header section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <h1 className="page-title">My Courses</h1>
          {/* Search + Add Course (right side) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute', left: 12, fontSize: 20, color: '#434749', pointerEvents: 'none',
              }}>search</span>
              <input
                className="input"
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 14px 10px 40px', fontSize: 16, minWidth: 280,
                  border: '2px solid #181f21', background: '#ffffff',
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
                  boxShadow: '4px 4px 0px 0px #181f21',
                }}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>Add Course</button>
          </div>
        </div>
      </section>

      {/* Filter Bar — Stitch-accurate rectangular buttons */}
      {!loading && courses.length > 0 && (
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
          {/* "All" button — always first */}
          <button
            onClick={() => setFilterTags([])}
            style={{
              padding: '8px 24px',
              border: '2px solid #181f21',
              background: filterTags.length === 0 ? '#181f21' : '#ffffff',
              color: filterTags.length === 0 ? '#ffffff' : '#181f21',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              boxShadow: filterTags.length === 0 ? '4px 4px 0px 0px #181f21' : 'none',
              transition: 'all 0.15s',
            }}
          >
            All
          </button>
          {/* Dynamic tag buttons */}
          {allTags.map((tag) => {
            const isActive = filterTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '8px 24px',
                  border: '2px solid #181f21',
                  background: isActive ? '#181f21' : '#ffffff',
                  color: isActive ? '#ffffff' : '#181f21',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 16, fontWeight: 600, cursor: 'pointer',
                  boxShadow: isActive ? '4px 4px 0px 0px #181f21' : 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#d0e3c1'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = '#ffffff'; }}
              >
                {tag}
              </button>
            );
          })}
        </section>
      )}

      {/* Filtered count indicator */}
      {(filterTags.length > 0 || searchQuery.trim()) && (
        <p style={{ color: '#747879', fontSize: 13, marginBottom: 12, fontFamily: "'Public Sans', sans-serif" }}>
          Showing {filteredCourses.length} of {courses.length} course{courses.length !== 1 ? 's' : ''}
        </p>
      )}

      {loading ? (
        <Spinner pad={80} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No courses yet"
          sub="Import a YouTube playlist or build a course manually."
          action="Add your first course"
          onAction={() => setShowModal(true)}
        />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No matching courses"
          sub={`No courses match the selected tag${filterTags.length > 1 ? 's' : ''}.`}
          action="Clear filters"
          onAction={() => setFilterTags([])}
        />
      ) : (
        <>
          {/* Course Grid — with thick top border divider matching Stitch screen */}
          <div className="grid-3" style={{ borderTop: '4px solid #181f21', paddingTop: 24 }}>
            {filteredCourses.map((c) => (
              <CourseCard key={c._id} course={c} onClick={() => navigate(`/courses/${c._id}`)} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32 }}>
              <button className="btn-ghost" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Prev</button>
              <span className="label-caps" style={{ color: '#747879' }}>{pagination.page} / {pagination.totalPages}</span>
              <button className="btn-ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showModal && (
        <Modal title="Add Course" onClose={() => setShowModal(false)} wide>
          {/* Source tabs */}
          <div className="pill-tabs" style={{ marginBottom: 22 }}>
            <button className={`pill-tab${tab === 'youtube' ? ' active' : ''}`} onClick={() => setTab('youtube')}>▶ YouTube Playlist</button>
            <button className={`pill-tab${tab === 'manual'  ? ' active' : ''}`} onClick={() => setTab('manual') }>✏ Manual Course</button>
          </div>

          {tab === 'youtube'
            ? <YouTubeForm onDone={() => { setShowModal(false); load(1); }} />
            : <ManualForm  onDone={() => { setShowModal(false); load(1); }} />
          }
        </Modal>
      )}
    </div>
  );
}
