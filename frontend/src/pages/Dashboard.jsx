import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, goalsAPI, streakAPI } from '../api';
import { pct, ytThumb } from '../utils';
import { Spinner, ProgressBar, EmptyState } from '../components/UI';
import { useAuth } from '../hooks/useAuth';
import StreakCalendar from '../components/StreakCalendar';

/** Format seconds → "MM:SS" or "H:MM:SS" clock style */
const fmtClock = (s) => {
  if (!s || s <= 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const carouselRef = useRef(null);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Today's Goal from DB
  const [todayGoal, setTodayGoal] = useState(null);

  // Streak data
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    // Load all dashboard data in parallel
    Promise.all([
      dashboardAPI.get(),
      goalsAPI.getToday(),
      streakAPI.get(),
    ]).then(([dashData, goalData, streakData]) => {
      setData(dashData);
      setTodayGoal(goalData.goal);
      setStreak(streakData);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner pad={100} />;
  if (!data)   return <p style={{ color: '#747879', padding: 60, textAlign: 'center' }}>Failed to load dashboard.</p>;

  const { continueWatching, recentCourses } = data;
  const displayCourses = recentCourses.slice(0, 10);

  // Today's goal progress (from DB)
  const tasks = todayGoal?.tasks || [];
  const completedTasks = tasks.filter((t) => t.done).length;
  const totalTasks = tasks.length;
  const nextTask = tasks.find((t) => !t.done);

  // Carousel scroll
  const scrollCarousel = (dir) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Learner';

  return (
    <div className="page-wrapper fade-up" style={{ paddingTop: 24, paddingBottom: 80 }}>

      {/* ── Hero Section — 50/50 Split ──────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>

        {/* Left Column: Welcome + Dive Back In */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h1 className="page-title">Welcome Back, {firstName}!</h1>

          {/* Dive Back In Card */}
          {continueWatching ? (
            <div className="pixel-card" style={{ background: '#ffffff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Slate header bar */}
              <div style={{
                background: '#181f21', padding: '10px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fbfaee',
                }}>Dive Back In</span>
                <span className="material-symbols-outlined" style={{ color: '#fbfaee', fontSize: 18 }}>play_circle</span>
              </div>

              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                {/* Video thumbnail with play overlay */}
                <div
                  style={{
                    aspectRatio: '16/9', width: '100%', border: '2px solid #181f21',
                    position: 'relative', cursor: 'pointer', overflow: 'hidden',
                  }}
                  onClick={() => navigate(`/courses/${continueWatching.courseId}/watch/${continueWatching.videoId}`)}
                >
                  {(() => {
                    const cwThumb = ytThumb(continueWatching.thumbnailUrl, continueWatching.videoUrl);
                    return cwThumb ? (
                      <img src={cwThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#efeee3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🎬</div>
                    );
                  })()}
                  {/* Play overlay on hover */}
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(24,31,33,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  >
                    <div style={{ background: '#fbfaee', padding: 16, border: '2px solid #181f21' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 36 }}>play_arrow</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="label-caps" style={{ color: '#536348', margin: '0 0 4px', textTransform: 'uppercase' }}>
                    {continueWatching.courseTitle}
                  </p>
                  <h2 style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 24, fontWeight: 600, lineHeight: 1.3,
                    color: '#181f21', margin: '0 0 16px',
                  }}>
                    {continueWatching.videoTitle}
                  </h2>
                  {/* Time progress */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                  }}>
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontSize: 12,
                      fontWeight: 700, color: '#434749', letterSpacing: '0.05em',
                    }}>
                      {fmtClock(continueWatching.watchedSeconds)} / {fmtClock(continueWatching.duration)}
                    </span>
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontSize: 12,
                      fontWeight: 700, color: '#536348', letterSpacing: '0.05em',
                    }}>
                      {pct(continueWatching.watchedSeconds, continueWatching.duration)}%
                    </span>
                  </div>
                  <button
                    className="btn-primary pixel-card"
                    style={{ width: '100%', padding: '14px 24px' }}
                    onClick={() => navigate(`/courses/${continueWatching.courseId}/watch/${continueWatching.videoId}`)}
                  >
                    RESUME LESSON
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pixel-card" style={{ background: '#ffffff', padding: 32, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon="▶"
                title="Nothing in progress"
                sub="Start watching a course to see it here."
                action="Browse courses"
                onAction={() => navigate('/courses')}
              />
            </div>
          )}
        </div>

        {/* Right Column: Compact Goal + Calendar Streak */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ height: 58 }} /> {/* Spacer to align with title height */}

          {/* ── Compressed Today's Goal Card ──────────────────────────── */}
          <div
            className="pixel-card"
            onClick={() => navigate('/plan')}
            style={{
              background: '#e9e9dd', padding: 20, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#deded2'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#e9e9dd'}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: '#181f21', margin: 0,
              }}>Today's Goal</h2>
              <span className="label-caps" style={{ color: '#536348', fontSize: 10 }}>
                {completedTasks}/{totalTasks} done
              </span>
            </div>

            {/* Compact segmented progress bar */}
            <div style={{
              height: 20, width: '100%', border: '2px solid #181f21',
              background: '#ffffff', display: 'flex', padding: 3, marginBottom: 12,
            }}>
              {totalTasks > 0 ? (
                tasks.map((t, i) => (
                  <div key={t._id} style={{
                    flex: 1, height: '100%',
                    background: t.done ? '#536348' : '#e9e9dd',
                    borderRight: i < totalTasks - 1 ? '2px solid #fbfaee' : 'none',
                    transition: 'background 0.3s',
                  }} />
                ))
              ) : (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: '100%', background: '#e9e9dd',
                    borderRight: i < 4 ? '2px solid #fbfaee' : 'none',
                  }} />
                ))
              )}
            </div>

            {/* Single next task */}
            {nextTask ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 10, background: '#ffffff', border: '2px solid #181f21',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="label-caps" style={{ color: '#181f21', opacity: 0.4, fontSize: 10 }}>
                    {String(completedTasks + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontFamily: "'Public Sans', sans-serif",
                    fontSize: 14, fontWeight: 700, color: '#181f21',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{nextTask.text}</span>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#181f21', fontSize: 18 }}>chevron_right</span>
              </div>
            ) : totalTasks > 0 ? (
              <div style={{
                padding: 10, background: 'rgba(83,99,72,0.1)', border: '2px solid #536348',
                textAlign: 'center',
              }}>
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
                  color: '#536348', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>✓ All tasks completed!</span>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 10, background: '#ffffff', border: '2px solid #181f21', opacity: 0.5,
              }}>
                <span style={{
                  fontFamily: "'Public Sans', sans-serif",
                  fontSize: 14, fontWeight: 700, color: '#181f21',
                }}>Set tasks in Plan My Day</span>
                <span className="material-symbols-outlined" style={{ color: '#181f21', fontSize: 18 }}>chevron_right</span>
              </div>
            )}
          </div>

          {/* ── Calendar Streak Card ──────────────────────────────────── */}
          <StreakCalendar streak={streak} compact />
        </div>
      </section>

      {/* ── Recent Courses Carousel ───────────────────────────────────── */}
      <section style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: '#181f21', margin: 0,
          }}>Recent Courses</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => scrollCarousel(-1)}
              style={{
                width: 40, height: 40, border: '2px solid #181f21',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#ffffff', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d0e3c1'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button
              onClick={() => scrollCarousel(1)}
              style={{
                width: 40, height: 40, border: '2px solid #181f21',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#ffffff', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d0e3c1'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
            >
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>

        {displayCourses.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No courses yet"
            sub="Import a YouTube playlist or create one manually."
            action="Add first course"
            onAction={() => navigate('/courses')}
          />
        ) : (
          <>
            {/* Horizontal scrolling carousel */}
            <div
              ref={carouselRef}
              style={{
                display: 'flex', gap: 24, overflowX: 'auto',
                scrollSnapType: 'x mandatory', paddingBottom: 16, paddingLeft: 2, paddingTop: 4,
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}
            >
              {displayCourses.map((c) => {
                const cp = c.totalVideos > 0 ? Math.round((c.completedVideos / c.totalVideos) * 100) : 0;
                const thumb = ytThumb(c.thumbnailUrl, c.firstVideoUrl);
                return (
                  <div
                    key={c.courseId}
                    className="pixel-card"
                    onClick={() => navigate(`/courses/${c.courseId}`)}
                    style={{
                      minWidth: 300, scrollSnapAlign: 'start',
                      background: '#ffffff', padding: 16, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f4e8'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    {/* Course thumbnail */}
                    <div style={{
                      aspectRatio: '16/9', width: '100%', border: '2px solid #181f21',
                      marginBottom: 16, overflow: 'hidden',
                    }}>
                      {thumb ? (
                        <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} loading="lazy"
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#efeee3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎬</div>
                      )}
                    </div>

                    {/* Course title */}
                    <h3 style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 24, fontWeight: 600, lineHeight: 1.3,
                      color: '#181f21', margin: '0 0 8px',
                    }}>
                      {c.title}
                    </h3>

                    {/* Progress row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="label-caps" style={{ color: '#434749' }}>Progress</span>
                      <span className="label-caps" style={{ color: '#181f21' }}>{c.completedVideos}/{c.totalVideos} watched</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      height: 12, border: '2px solid #181f21', background: '#ffffff', padding: 2,
                    }}>
                      <div style={{ height: '100%', width: `${cp}%`, background: '#536348', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}

              {/* "Go to My Courses" — inline end-of-row card (Netflix-style) */}
              <div
                className="pixel-card"
                onClick={() => navigate('/courses')}
                style={{
                  minWidth: 300, scrollSnapAlign: 'start',
                  background: '#e9e9dd', padding: 16, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 16, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d0e3c1'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e9e9dd'}
              >
                <div style={{
                  width: 64, height: 64, border: '2px solid #181f21',
                  background: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#181f21' }}>arrow_forward</span>
                </div>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 20, fontWeight: 600, color: '#181f21',
                  textAlign: 'center',
                }}>
                  View All
                </span>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
