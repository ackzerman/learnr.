import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { coursesAPI, progressAPI, notesAPI } from '../api';
import { fmt, pct, ytVideoId, ytThumb } from '../utils';
import { Spinner, ProgressBar, VideoCircle } from '../components/UI';
import { useToast } from '../hooks/useToast';

export default function VideoPlayer() {
  const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Data
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [curVid, setCurVid] = useState(null);
  const [loading, setLoading] = useState(true);

  // Progress tracking
  const [watched, setWatched] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  // Notes
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(true);
  const noteTimer = useRef(null);

  // Starred
  const [starred, setStarred] = useState(false);

  /* ── Load course detail ───────────────────────────────────────────── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const d = await coursesAPI.getDetails(courseId);
      setCourse(d.course);
      setVideos(d.videos);
      const vid = d.videos.find((v) => v.videoId === videoId) || d.videos[0];
      setCurVid(vid);
      setWatched(vid?.progress?.watchedSeconds || 0);
      setStarred(vid?.progress?.starred || false);
      // Load note for this video
      const nd = await notesAPI.get(vid.videoId);
      setNote(nd.note?.content || '');
      setNoteSaved(true);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [courseId, videoId]);

  useEffect(() => {
    loadAll();
    return () => { clearInterval(timerRef.current); clearTimeout(noteTimer.current); };
  }, []);

  /* ── Switch video ─────────────────────────────────────────────────── */
  const switchTo = async (vid) => {
    // Flush current progress first
    if (playing) await flushProgress();
    setPlaying(false);
    setCurVid(vid);
    setWatched(vid.progress?.watchedSeconds || 0);
    setStarred(vid.progress?.starred || false);
    // Load new note
    try {
      const nd = await notesAPI.get(vid.videoId);
      setNote(nd.note?.content || '');
      setNoteSaved(true);
    } catch { setNote(''); }
    // Update URL without remounting
    window.history.replaceState({}, '', `/courses/${courseId}/watch/${vid.videoId}`);
  };

  /* ── Progress timer ───────────────────────────────────────────────── */
  const flushProgress = async () => {
    if (!startRef.current || !curVid) return;
    const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
    if (elapsed <= 0) return;
    const total = watched + elapsed;
    startRef.current = null;
    setWatched(total);
    try {
      const d = await progressAPI.update(curVid.videoId, total);
      // Refresh completion state on sidebar
      setVideos((prev) => prev.map((v) =>
        v.videoId === curVid.videoId
          ? { ...v, progress: { ...v.progress, watchedSeconds: total, completed: d.completed } }
          : v
      ));
      if (d.completed && !curVid.progress.completed) {
        toast('Video complete! ✓', 'success');
        setCurVid((c) => c ? { ...c, progress: { ...c.progress, completed: true } } : c);
      }
    } catch { }
  };

  useEffect(() => {
    if (playing) {
      startRef.current = Date.now();
      timerRef.current = setInterval(async () => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        const total = watched + elapsed;
        try { await progressAPI.update(curVid.videoId, total); } catch { }
      }, 15000);
    } else {
      clearInterval(timerRef.current);
      flushProgress();
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  /* ── Mark complete ────────────────────────────────────────────────── */
  const markComplete = async () => {
    if (!curVid) return;
    try {
      await progressAPI.update(curVid.videoId, curVid.duration);
      setWatched(curVid.duration);
      setCurVid((c) => c ? { ...c, progress: { ...c.progress, watchedSeconds: c.duration, completed: true } } : c);
      setVideos((prev) => prev.map((v) =>
        v.videoId === curVid.videoId ? { ...v, progress: { ...v.progress, completed: true } } : v
      ));
      toast('Marked as complete ✓');
    } catch (e) { toast(e.message, 'error'); }
  };

  /* ── Notes auto-save ──────────────────────────────────────────────── */
  const handleNoteChange = (val) => {
    setNote(val);
    setNoteSaved(false);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      try {
        await notesAPI.save(curVid.videoId, val);
        setNoteSaved(true);
      } catch { }
    }, 1200);
  };

  const deleteNote = async () => {
    if (!confirm('Delete this note permanently?')) return;
    try {
      await notesAPI.delete(curVid.videoId);
      setNote('');
      setNoteSaved(true);
      toast('Note deleted');
    } catch (e) { toast(e.message, 'error'); }
  };

  /* ── Toggle star ──────────────────────────────────────────────────── */
  const handleToggleStar = async () => {
    const next = !starred;
    setStarred(next); // optimistic
    try {
      const res = await progressAPI.toggleStar(curVid.videoId);
      setStarred(res.starred);
      // Keep sidebar in sync
      setVideos((prev) => prev.map((v) =>
        v.videoId === curVid.videoId
          ? { ...v, progress: { ...v.progress, starred: res.starred } }
          : v
      ));
    } catch (e) {
      setStarred(!next); // revert
      toast(e.message, 'error');
    }
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  if (loading || !curVid) return <Spinner pad={100} />;

  const idx = videos.findIndex((v) => v.videoId === curVid.videoId);
  const prev = idx > 0 ? videos[idx - 1] : null;
  const next = idx < videos.length - 1 ? videos[idx + 1] : null;
  const wp = pct(watched, curVid.duration);
  const ytId = ytVideoId(curVid.videoUrl);

  return (
    <div className="fade-up" style={{
      maxWidth: 1200, margin: '0 auto', padding: '24px 40px',
      display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24,
    }}>
      {/* ── Main column ───────────────────────────────────────────────── */}
      <div>
        <button className="btn-ghost" style={{ marginBottom: 14, fontSize: 13 }} onClick={() => navigate(`/courses/${courseId}`)}>
          ← {course?.title || 'Back to course'}
        </button>

        {/* Video embed / player */}
        <div style={{ background: '#181f21', borderRadius: 0, overflow: 'hidden', marginBottom: 16, border: '4px solid #181f21' }}>
          {ytId ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                title={curVid.title}
              />
            </div>
          ) : curVid.videoUrl ? (
            <video controls style={{ width: '100%', display: 'block', maxHeight: 480 }} src={curVid.videoUrl} />
          ) : (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 48, margin: '0 0 12px' }}>🎬</p>
              <p style={{ color: '#c3c7c8', fontSize: 14 }}>No video URL for this lesson.</p>
            </div>
          )}
        </div>

        {/* Video info + controls */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 20, fontWeight: 700, color: '#181f21', margin: '0 0 5px', letterSpacing: '-0.01em',
              }}>
                {curVid.title}
              </h2>
              <p className="label-caps" style={{ color: '#747879', fontSize: 10, margin: 0 }}>
                {fmt(curVid.duration)} &nbsp;·&nbsp; Video {idx + 1} of {videos.length}
                {curVid.progress.completed && (
                  <span style={{ color: '#536348', marginLeft: 10, fontWeight: 700 }}>✓ Completed</span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Star button */}
              <button
                onClick={handleToggleStar}
                title={starred ? 'Unstar video' : 'Star as important'}
                style={{
                  background: starred ? 'rgba(83,99,72,0.12)' : 'transparent',
                  border: `2px solid ${starred ? '#536348' : '#181f21'}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '7px 11px',
                  color: starred ? '#536348' : '#c3c7c8',
                  transition: 'all 0.15s',
                }}
              >
                {starred ? '★' : '☆'}
              </button>
              {/*<button
                className="btn-ghost"
                style={{ borderColor: playing ? 'rgba(83,99,72,0.5)' : '', color: playing ? '#536348' : '' }}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? '⏸ Timer on' : '▶ Start timer'}
              </button>*/}
              {!curVid.progress.completed && (
                <button className="btn-success" onClick={markComplete}>Mark complete</button>
              )}
            </div>
          </div>

          {/* Watch progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label-caps" style={{ color: '#747879', fontSize: 10 }}>{fmt(watched)} watched</span>
              <span className="label-caps" style={{ color: '#747879', fontSize: 10 }}>{fmt(curVid.duration)} total · {wp}%</span>
            </div>
            <ProgressBar value={wp} color={curVid.progress.completed ? '#536348' : '#536348'} height={6} />
          </div>

          {/* Prev / Next */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn-ghost" disabled={!prev} onClick={() => prev && switchTo(prev)}>← Previous</button>
            <button className="btn-ghost" disabled={!next} onClick={() => next && switchTo(next)}>Next →</button>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16, fontWeight: 700, color: '#181f21', margin: 0, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
              My notes
            </h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="label-caps" style={{ fontSize: 10, color: noteSaved ? '#536348' : '#747879', transition: 'color 0.3s' }}>
                {noteSaved ? 'Saved ✓' : 'Saving…'}
              </span>
              {note && <button className="btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={deleteNote}>Delete note</button>}
            </div>
          </div>
          <textarea
            className="input"
            style={{ minHeight: 160, lineHeight: 1.65, fontSize: 14 }}
            placeholder="Take notes for this video… they auto-save as you type."
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
          />
        </div>
      </div>

      {/* ── Playlist sidebar ───────────────────────────────────────────── */}
      <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 76, padding: '16px 14px' }}>
        <h3 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14, fontWeight: 700, color: '#181f21', marginBottom: 12,
        }}>
          Playlist &nbsp;
          <span style={{ color: '#747879', fontWeight: 500 }}>({videos.length})</span>
        </h3>

        <div className="scroll-list" style={{ maxHeight: '72vh', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {videos.map((v, i) => {
            const isActive = v.videoId === curVid.videoId;
            const vwp = pct(v.progress.watchedSeconds, v.duration);
            return (
              <div
                key={v.videoId}
                className={`video-row${isActive ? ' active' : ''}`}
                onClick={() => switchTo(v)}
              >
                <VideoCircle index={i} completed={v.progress.completed} active={isActive} />
                {(() => {
                  const vThumb = ytThumb(v.thumbnailUrl, v.videoUrl);
                  return vThumb ? (
                    <img src={vThumb} alt="" className="thumb-sidebar" loading="lazy" />
                  ) : null;
                })()}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <p style={{
                      color: isActive ? '#536348' : '#181f21',
                      fontSize: 12, fontWeight: isActive ? 700 : 400,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      fontFamily: "'Public Sans', sans-serif",
                    }}>
                      {v.title}
                    </p>
                    {v.progress?.starred && (
                      <span style={{ color: '#003365', fontSize: 12, flexShrink: 0 }}>★</span>
                    )}
                  </div>
                  <p className="label-caps" style={{ color: '#c3c7c8', fontSize: 10, margin: '2px 0 0' }}>{fmt(v.duration)}</p>
                  {v.progress.watchedSeconds > 0 && !v.progress.completed && (
                    <div style={{ marginTop: 4 }}>
                      <ProgressBar value={vwp} height={2} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}