import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { goalsAPI, coursesAPI } from '../api';
import { Spinner, Modal, LabelInput } from '../components/UI';
import { useToast } from '../hooks/useToast';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function isToday(dateStr) {
  return dateStr === toDateString(new Date());
}

function getDayLabel(dateStr) {
  const today = toDateString(new Date());
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

/* ─── Task checkbox — retro square ────────────────────────────────────────── */
function TaskCheckbox({ checked, onChange, disabled }) {
  return (
    <label style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      <div
        style={{
          width: 20,
          height: 20,
          border: '2px solid #181f21',
          background: checked ? '#536348' : '#fbfaee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: '#fbfaee',
          transition: 'all 0.15s',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {checked && '✓'}
      </div>
    </label>
  );
}

/* ─── Score Badge — displayed for past days ────────────────────────────────── */
function ScoreBadge({ completed, total }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const emoji = pct === 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '⚡' : pct > 0 ? '💪' : '😴';
  const label = pct === 100 ? 'PERFECT' : pct >= 75 ? 'GREAT' : pct >= 50 ? 'GOOD' : pct > 0 ? 'STARTED' : 'NO TASKS';
  const barColor = pct === 100 ? '#536348' : pct >= 75 ? '#536348' : pct >= 50 ? '#b59e00' : '#ba1a1a';

  return (
    <div
      style={{
        background: '#181f21',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '4px 4px 0 0 #181f21',
        border: '2px solid #181f21',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 36 }}>{emoji}</span>
          <div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 28,
                fontWeight: 700,
                color: '#fbfaee',
                lineHeight: 1,
              }}
            >
              {pct}%
            </div>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: barColor,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: '#fbfaee',
            }}
          >
            {completed} / {total}
          </div>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: '#959c9f',
              letterSpacing: '0.1em',
            }}
          >
            COMPLETED
          </span>
        </div>
      </div>
      {/* Score bar */}
      <div
        style={{
          height: 12,
          width: '100%',
          border: '2px solid #fbfaee',
          position: 'relative',
          overflow: 'hidden',
          background: '#2a3234',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background: barColor,
            width: `${pct}%`,
            transition: 'width 0.5s',
            backgroundImage: 'linear-gradient(to right, #181f21 2px, transparent 2px)',
            backgroundSize: '10% 100%',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Plan Your Day — Stitch Screen Layout ────────────────────────────────── */
export default function PlanYourDay() {
  const toast = useToast();
  const navigate = useNavigate();
  const dateInputRef = useRef(null);
  const [loading, setLoading] = useState(true);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const isTodaySelected = isToday(selectedDate);
  const isFutureDate = selectedDate > toDateString(new Date());

  // Goal data
  const [goal, setGoal] = useState(null);
  const [dailyGoal, setDailyGoal] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Courses for "Active Course Progress"
  const [courses, setCourses] = useState([]);

  // Weekly goal data
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [weeklyTasks, setWeeklyTasks] = useState([]);
  const [newWeeklyTask, setNewWeeklyTask] = useState('');
  const [weeklySearchResults, setWeeklySearchResults] = useState([]);
  const [selectedWeeklyCourse, setSelectedWeeklyCourse] = useState(null);
  const [weekStart, setWeekStart] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [dateRes, courseRes, weeklyRes] = await Promise.all([
          goalsAPI.getByDate(selectedDate),
          coursesAPI.list(1, 10),
          goalsAPI.getWeekly(),
        ]);
        const g = dateRes.goal;
        setGoal(g);
        setDailyGoal(g?.description || '');
        setTasks(g?.tasks || []);
        setCourses(courseRes.courses || []);
        setWeeklyGoal(weeklyRes.goal);
        setWeeklyTasks(weeklyRes.goal?.tasks || []);
        setWeekStart(weeklyRes.weekStart || '');
      } catch (err) {
        console.error(err);
        setGoal(null);
        setDailyGoal('');
        setTasks([]);
      }
      setLoading(false);
    };
    loadData();
  }, [selectedDate]);

  // Debounced video search
  useEffect(() => {
    if (!newTask.trim() || (selectedVideo && selectedVideo.title === newTask.trim())) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const delay = setTimeout(async () => {
      try {
        const res = await coursesAPI.searchVideos(newTask.trim());
        setSearchResults(res.videos || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [newTask, selectedVideo]);



  // Daily goal description — debounced save
  const updateDailyGoal = (val) => {
    setDailyGoal(val);
    clearTimeout(updateDailyGoal._timer);
    updateDailyGoal._timer = setTimeout(async () => {
      try {
        await goalsAPI.save({ type: 'daily', description: val });
      } catch (_err) {
        console.error(_err);
      }
    }, 800);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const payload = { text: newTask.trim() };
      if (selectedVideo && selectedVideo.title === newTask.trim()) {
        payload.videoId = selectedVideo._id;
        payload.courseId = selectedVideo.courseId;
      }
      const res = await goalsAPI.addTask(payload);
      setGoal(res.goal);
      setTasks(res.goal.tasks);
      setNewTask('');
      setSelectedVideo(null);
      setSearchResults([]);
      toast('Task added ✓');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleTask = async (taskId) => {
    try {
      const res = await goalsAPI.toggleTask(taskId, selectedDate);
      setGoal(res.goal);
      setTasks(res.goal.tasks);
      if (res.allCompleted) {
        toast('Daily goal complete!');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const res = await goalsAPI.deleteTask(taskId, selectedDate);
      setGoal(res.goal);
      setTasks(res.goal.tasks);
      toast('Task removed');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ── Weekly task handlers ─────────────────────────────────
  // Client-side course search for weekly tasks
  useEffect(() => {
    if (!newWeeklyTask.trim() || (selectedWeeklyCourse && selectedWeeklyCourse.title === newWeeklyTask.trim())) {
      setWeeklySearchResults([]);
      return;
    }
    const query = newWeeklyTask.trim().toLowerCase();
    const matched = courses.filter((c) => c.title.toLowerCase().includes(query));
    setWeeklySearchResults(matched);
  }, [newWeeklyTask, selectedWeeklyCourse, courses]);

  const addWeeklyTask = async () => {
    if (!newWeeklyTask.trim()) return;
    try {
      const payload = { text: newWeeklyTask.trim() };
      if (selectedWeeklyCourse && selectedWeeklyCourse.title === newWeeklyTask.trim()) {
        payload.courseId = selectedWeeklyCourse.courseId;
      }
      const res = await goalsAPI.addWeeklyTask(payload);
      setWeeklyGoal(res.goal);
      setWeeklyTasks(res.goal.tasks);
      setNewWeeklyTask('');
      setSelectedWeeklyCourse(null);
      setWeeklySearchResults([]);
      toast('Weekly task added ✓');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleWeeklyTask = async (taskId) => {
    try {
      const res = await goalsAPI.toggleWeeklyTask(taskId);
      setWeeklyGoal(res.goal);
      setWeeklyTasks(res.goal.tasks);
      if (res.allCompleted) {
        toast('All weekly goals complete! 🎉');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const deleteWeeklyTask = async (taskId) => {
    try {
      const res = await goalsAPI.deleteWeeklyTask(taskId);
      setWeeklyGoal(res.goal);
      setWeeklyTasks(res.goal.tasks);
      toast('Weekly task removed');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Date navigation handlers
  const goToPrevDay = () => setSelectedDate(shiftDate(selectedDate, -1));
  const goToNextDay = () => {
    const next = shiftDate(selectedDate, 1);
    if (next <= toDateString(new Date())) setSelectedDate(next);
  };
  const goToToday = () => setSelectedDate(toDateString(new Date()));
  const handleDatePick = (e) => {
    const val = e.target.value;
    if (val && val <= toDateString(new Date())) {
      setSelectedDate(val);
    }
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const totalTasks = tasks.length;
  const canGoForward = shiftDate(selectedDate, 1) <= toDateString(new Date());

  // Weekly computed values
  const weeklyCompletedCount = weeklyTasks.filter((t) => t.done).length;
  const weeklyTotalTasks = weeklyTasks.length;
  const weekEndDate = weekStart ? (() => {
    const d = new Date(weekStart + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    return toDateString(d);
  })() : '';
  const weekLabel = weekStart
    ? `${formatDate(weekStart)} — ${formatDate(weekEndDate)}`
    : 'This Week';

  if (loading) return <Spinner pad={100} />;

  // Courses with progress for the weekly panel
  const activeCourses = courses
    .filter((c) => c.totalVideos > 0)
    .map((c) => ({
      ...c,
      progress: Math.round((c.completedVideos / c.totalVideos) * 100),
    }))
    .slice(0, 4);

  return (
    <div className="page-wrapper fade-up" style={{ paddingBottom: 80 }}>
      {/* ── Top Header Bar — Date Navigator ────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 64,
          borderBottom: '4px solid #181f21',
          marginBottom: 32,
        }}
      >
        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Prev day */}
          <button
            onClick={goToPrevDay}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fbfaee',
              border: '2px solid #181f21',
              cursor: 'pointer',
              transition: 'all 0.1s',
              boxShadow: '2px 2px 0 0 #181f21',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#d0e3c1';
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fbfaee';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              chevron_left
            </span>
          </button>

          {/* Clickable date label — opens native date picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#efeee3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 24,
                  fontWeight: 600,
                  color: '#181f21',
                }}
              >
                {formatDate(selectedDate)}
              </span>
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color: isTodaySelected ? '#536348' : '#747879',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: isTodaySelected ? '#d0e3c1' : '#efeee3',
                  padding: '2px 8px',
                  border: '1px solid ' + (isTodaySelected ? '#536348' : '#c3c7c8'),
                }}
              >
                {getDayLabel(selectedDate)}
              </span>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#747879' }}
              >
                calendar_month
              </span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              max={toDateString(new Date())}
              onChange={handleDatePick}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: -1,
              }}
            />
          </div>

          {/* Next day */}
          <button
            onClick={goToNextDay}
            disabled={!canGoForward}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: canGoForward ? '#fbfaee' : '#efeee3',
              border: '2px solid #181f21',
              cursor: canGoForward ? 'pointer' : 'not-allowed',
              transition: 'all 0.1s',
              boxShadow: canGoForward ? '2px 2px 0 0 #181f21' : 'none',
              opacity: canGoForward ? 1 : 0.4,
            }}
            onMouseEnter={(e) => {
              if (canGoForward) {
                e.currentTarget.style.background = '#d0e3c1';
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (canGoForward) {
                e.currentTarget.style.background = '#fbfaee';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              chevron_right
            </span>
          </button>

          {/* Today shortcut */}
          {!isTodaySelected && (
            <button
              onClick={goToToday}
              style={{
                marginLeft: 8,
                padding: '6px 14px',
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: '#181f21',
                color: '#fbfaee',
                border: '2px solid #181f21',
                cursor: 'pointer',
                transition: 'all 0.1s',
                boxShadow: '2px 2px 0 0 #536348',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#536348';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#181f21';
              }}
            >
              ← Today
            </button>
          )}
        </div>

        {/* Add Goals button — only for today */}
        {isTodaySelected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="btn-primary pixel-card"
              style={{ padding: '10px 20px' }}
              onClick={() => setShowModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                add
              </span>
              Add Goals
            </button>
          </div>
        )}
      </div>

      {/* ── Score badge for past dates — always shown ──────────── */}
      {!isTodaySelected && <ScoreBadge completed={completedCount} total={totalTasks} />}

      {/* ── No tasks for this date ─────────────────────────────── */}
      {!isTodaySelected && totalTasks === 0 && (
        <div
          style={{
            background: '#fbfaee',
            border: '2px solid #181f21',
            boxShadow: '4px 4px 0 0 #181f21',
            padding: 48,
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          <p style={{ fontSize: 48, marginBottom: 12 }}>📭</p>
          <h3
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 20,
              fontWeight: 600,
              color: '#181f21',
              marginBottom: 8,
            }}
          >
            No goals set for {formatDate(selectedDate)}
          </h3>
          <p
            style={{
              color: '#747879',
              fontSize: 14,
              fontFamily: "'Public Sans', sans-serif",
            }}
          >
            You didn't plan any tasks for this day.
          </p>
        </div>
      )}

      {/* ── Daily Goals Section ────────────────────────────────── */}
      {(isTodaySelected || totalTasks > 0) && (
        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderBottom: '2px solid #181f21',
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 32,
                fontWeight: 700,
                color: '#181f21',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Daily Goals
            </h2>
            <span
              className="label-caps"
              style={{ color: '#434749' }}
            >
              {completedCount} / {totalTasks} COMPLETED
            </span>
          </div>

          {/* Horizontal scrolling task cards */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              overflowX: 'auto',
              paddingBottom: 24,
              paddingTop: 8,
              paddingLeft: 2,
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {tasks.length === 0 ? (
              <div
                style={{
                  minWidth: 320,
                  background: '#fbfaee',
                  border: '2px solid #181f21',
                  boxShadow: '4px 4px 0 0 #181f21',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ height: 16, background: '#181f21', width: '100%' }} />
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
                  <p
                    style={{
                      color: '#747879',
                      fontSize: 14,
                      fontFamily: "'Public Sans', sans-serif",
                      marginBottom: 16,
                    }}
                  >
                    No tasks yet, add goals to get started.
                  </p>
                </div>
              </div>
            ) : (
              tasks.map((t, i) => (
                <div
                  key={t._id}
                  style={{
                    minWidth: 320,
                    background: '#fbfaee',
                    border: '2px solid #181f21',
                    boxShadow: '4px 4px 0 0 #181f21',
                    display: 'flex',
                    flexDirection: 'column',
                    scrollSnapAlign: 'start',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {/* Slate top bar — color-coded for past days */}
                  <div
                    style={{
                      height: 16,
                      background: !isTodaySelected
                        ? t.done ? '#536348' : '#ba1a1a'
                        : '#181f21',
                      width: '100%',
                    }}
                  />

                  {/* Card content */}
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    {/* Task number badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#747879',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        TASK {String(i + 1).padStart(2, '0')}
                      </span>
                      {isTodaySelected && (
                        <button
                          onClick={() => deleteTask(t._id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ba1a1a',
                            opacity: 0.4,
                            transition: 'opacity 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            close
                          </span>
                        </button>
                      )}
                      {!isTodaySelected && (
                        <span
                          style={{
                            fontFamily: "'Space Mono', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: t.done ? '#536348' : '#ba1a1a',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            background: t.done ? '#d0e3c1' : '#ffdad6',
                            padding: '2px 8px',
                            border: `1px solid ${t.done ? '#536348' : '#ba1a1a'}`,
                          }}
                        >
                          {t.done ? '✓ DONE' : '✗ MISSED'}
                        </span>
                      )}
                    </div>

                    {/* Task text */}
                    <h3
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: '#181f21',
                        margin: 0,
                        textDecoration: t.done ? 'line-through' : 'none',
                        opacity: t.done ? 0.5 : 1,
                        flex: 1,
                      }}
                    >
                      {t.videoId && t.courseId ? (
                        <Link
                          to={`/courses/${t.courseId}/watch/${t.videoId}`}
                          style={{ color: 'inherit', textDecoration: 'inherit' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.text} <span style={{ fontSize: 14, opacity: 0.7 }}>↗</span>
                        </Link>
                      ) : (
                        t.text
                      )}
                    </h3>

                    {/* Checkbox footer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid #efeee3',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: isTodaySelected ? 'pointer' : 'default',
                        }}
                        onClick={() => isTodaySelected && toggleTask(t._id)}
                      >
                        <TaskCheckbox checked={t.done} onChange={() => { }} disabled={!isTodaySelected} />
                        <span
                          style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: 14,
                            fontWeight: 600,
                            color: t.done ? '#536348' : '#434749',
                          }}
                        >
                          {t.done ? 'Completed' : 'Pending'}
                        </span>
                      </label>
                      {t.done ? (
                        <span
                          className="material-symbols-outlined"
                          style={{ color: '#536348', fontSize: 20 }}
                        >
                          check_circle
                        </span>
                      ) : (
                        <span
                          className="material-symbols-outlined"
                          style={{ color: '#c3c7c8', fontSize: 20 }}
                        >
                          circle
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ── Plan Your Week — 2-Column Layout (today only) ──────── */}
      {isTodaySelected && <section style={{ marginBottom: 40 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '2px solid #181f21',
            paddingBottom: 8,
            marginBottom: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 32,
                fontWeight: 700,
                color: '#181f21',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Plan Your Week
            </h2>
            <span className="label-caps" style={{ color: '#747879', marginTop: 4, display: 'block' }}>
              {weekLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-primary pixel-card"
              style={{ padding: '10px 20px' }}
              onClick={() => setShowWeeklyModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Add Task
            </button>
          </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            {/* Left: Active weekly tasks with per-course progress */}
            <div
              style={{
                background: '#fbfaee',
                border: '2px solid #181f21',
                padding: 24,
                boxShadow: '4px 4px 0 0 #181f21',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h3
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    paddingLeft: 12,
                    borderLeft: '4px solid #181f21',
                    color: '#181f21',
                    margin: 0,
                  }}
                >
                  Active Tasks
                </h3>
                <span className="label-caps" style={{ color: '#434749' }}>
                  {weeklyCompletedCount} / {weeklyTotalTasks} DONE
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {weeklyTasks.filter((t) => !t.done).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>
                      {weeklyTasks.length === 0 ? '📅' : '🎉'}
                    </p>
                    <p style={{ color: '#747879', fontSize: 14, fontFamily: "'Public Sans', sans-serif", marginBottom: 16 }}>
                      {weeklyTasks.length === 0
                        ? 'No weekly tasks planned yet.'
                        : 'All tasks completed this week!'}
                    </p>
                  
                  </div>
                ) : (
                  weeklyTasks.filter((t) => !t.done).map((t, i, activeTasks) => {
                    // Find matching course for progress bar
                    const matchedCourse = t.courseId
                      ? courses.find((c) => c.courseId === t.courseId)
                      : null;
                    const courseProgress = matchedCourse && matchedCourse.totalVideos > 0
                      ? Math.round((matchedCourse.completedVideos / matchedCourse.totalVideos) * 100)
                      : null;

                    return (
                      <div
                        key={t._id}
                        style={{
                          padding: '14px 0',
                          borderBottom: i < activeTasks.length - 1 ? '1px solid #efeee3' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div onClick={() => toggleWeeklyTask(t._id)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                            <TaskCheckbox checked={false} onChange={() => {}} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontFamily: "'Space Grotesk', sans-serif",
                                fontSize: 15, fontWeight: 600, color: '#181f21', margin: 0,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {t.courseId ? (
                                <Link to={`/courses/${t.courseId}`} style={{ color: 'inherit', textDecoration: 'inherit' }}>
                                  {t.text} <span style={{ fontSize: 12, opacity: 0.7 }}>↗</span>
                                </Link>
                              ) : t.text}
                            </p>
                            <span style={{
                              fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700,
                              color: '#747879', letterSpacing: '0.1em', textTransform: 'uppercase',
                            }}>
                              {matchedCourse
                                ? `${matchedCourse.completedVideos}/${matchedCourse.totalVideos} VIDEOS`
                                : `TASK ${String(i + 1).padStart(2, '0')}`}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteWeeklyTask(t._id)}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: '#ba1a1a', opacity: 0.3, transition: 'opacity 0.15s',
                              display: 'flex', alignItems: 'center', flexShrink: 0,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                          </button>
                        </div>

                        {/* Per-course progress bar */}
                        {courseProgress !== null && (
                          <div style={{ marginTop: 8, marginLeft: 32 }}>
                            <div style={{
                              height: 8, width: '100%', border: '1px solid #c3c7c8',
                              position: 'relative', overflow: 'hidden', background: '#efeee3',
                            }}>
                              <div style={{
                                position: 'absolute', top: 0, left: 0, height: '100%',
                                background: courseProgress >= 100 ? '#536348' : '#536348',
                                width: `${courseProgress}%`,
                                transition: 'width 0.5s',
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <span style={{
                                fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700,
                                color: '#959c9f', letterSpacing: '0.1em',
                              }}>
                                PROGRESS
                              </span>
                              <span style={{
                                fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700,
                                color: '#536348', letterSpacing: '0.1em',
                              }}>
                                {courseProgress}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Completed tasks this week — dark panel */}
            <div
              style={{
                background: '#181f21',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12, fontWeight: 700, color: '#959c9f',
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
                }}
              >
                COMPLETED THIS WEEK
              </span>

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400, paddingRight: 4 }}>
                {weeklyTasks.filter((t) => t.done).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ color: '#959c9f', fontSize: 13, fontFamily: "'Public Sans', sans-serif" }}>
                      No tasks completed yet this week.<br />Keep going!
                    </p>
                  </div>
                ) : (
                  weeklyTasks.filter((t) => t.done).map((t, i, arr) => (
                    <div
                      key={t._id}
                      style={{
                        borderBottom: i < arr.length - 1 ? '1px solid #41484a' : 'none',
                        paddingBottom: 12, marginBottom: 12,
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#536348', fontSize: 18, marginTop: 2, flexShrink: 0 }}>
                        check_circle
                      </span>
                      <div>
                        <p style={{
                          fontFamily: "'Space Grotesk', sans-serif", fontSize: 14,
                          fontWeight: 600, color: '#fbfaee', margin: 0, opacity: 0.8,
                        }}>
                          {t.courseId ? (
                            <Link to={`/courses/${t.courseId}`} style={{ color: 'inherit', textDecoration: 'inherit' }}>
                              {t.text} <span style={{ fontSize: 11, opacity: 0.7 }}>↗</span>
                            </Link>
                          ) : t.text}
                        </p>
                        <span style={{
                          fontFamily: "'Space Mono', monospace", fontSize: 10,
                          fontWeight: 700, color: '#536348', letterSpacing: '0.1em',
                        }}>
                          ✓ DONE
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>}


      {/* ── Add Goals Modal ────────────────────────────────────── */}
      {showModal && (
        <Modal title="Add Goals for Today" onClose={() => setShowModal(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Add task */}
            <div>
              <label className="label" style={{ marginBottom: 8, display: 'block' }}>Search for a video or type your own task</label>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Watch Docker Networking video..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTask();
                  }}
                  style={{ flex: 1 }}
                />
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 60, background: '#fff',
                    border: '2px solid #181f21', zIndex: 10,
                    maxHeight: 180, overflowY: 'auto', boxShadow: '4px 4px 0 0 #181f21'
                  }}>
                    {searchResults.map((v) => (
                      <div
                        key={v._id}
                        style={{ padding: '8px 12px', borderBottom: '1px solid #e9e9dd', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        onClick={() => {
                          setSelectedVideo(v);
                          setNewTask(v.title);
                          setSearchResults([]);
                        }}
                      >
                        <strong style={{ fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>{v.title}</strong>
                        <span style={{ fontSize: 12, color: '#747879' }}>{v.courseTitle}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={addTask}
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                </button>
              </div>
            </div>

            {/* Current tasks preview */}
            {tasks.length > 0 && (
              <div>
                <label className="label" style={{ marginBottom: 8, display: 'block' }}>Current Tasks ({tasks.length})</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '2px solid #e9e9dd' }}>
                  {tasks.map((t, i) => (
                    <div key={t._id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderBottom: i < tasks.length - 1 ? '1px solid #e9e9dd' : 'none',
                      background: t.done ? '#f5f4e8' : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, background: '#181f21', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}>
                          <span className="material-symbols-outlined" style={{ color: '#fbfaee', fontSize: 18 }}>
                            {t.done ? 'check' : 'task_alt'}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14,
                          color: '#181f21', textDecoration: t.done ? 'line-through' : 'none',
                          opacity: t.done ? 0.5 : 1,
                        }}>
                          {t.videoId && t.courseId ? (
                            <Link
                              to={`/courses/${t.courseId}/watch/${t.videoId}`}
                              style={{ color: 'inherit', textDecoration: 'inherit' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t.text} <span style={{ fontSize: 12, opacity: 0.7 }}>↗</span>
                            </Link>
                          ) : (
                            t.text
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              className="btn-primary"
              onClick={() => setShowModal(false)}
              style={{ width: '100%', marginTop: 8 }}
            >
              DONE
            </button>
          </div>
        </Modal>
      )}

      {/* ── Add Weekly Task Modal ──────────────────────────────── */}
      {showWeeklyModal && (
        <Modal title="Add Weekly Goals" onClose={() => setShowWeeklyModal(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: '#747879', fontSize: 13, fontFamily: "'Public Sans', sans-serif", margin: 0 }}>
              Add courses you want to make progress on this week.
            </p>

            <div>
              <label className="label" style={{ marginBottom: 8, display: 'block' }}>Search for a course or type a task</label>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Docker Networking Masterclass..."
                  value={newWeeklyTask}
                  onChange={(e) => setNewWeeklyTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addWeeklyTask(); }}
                  style={{ flex: 1 }}
                />
                {weeklySearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 60, background: '#fff',
                    border: '2px solid #181f21', zIndex: 10,
                    maxHeight: 180, overflowY: 'auto', boxShadow: '4px 4px 0 0 #181f21'
                  }}>
                    {weeklySearchResults.map((c) => (
                      <div
                        key={c.courseId}
                        style={{ padding: '8px 12px', borderBottom: '1px solid #e9e9dd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        onClick={() => { setSelectedWeeklyCourse(c); setNewWeeklyTask(c.title); setWeeklySearchResults([]); }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</strong>
                          <span style={{ fontSize: 12, color: '#747879' }}>{c.completedVideos}/{c.totalVideos} videos completed</span>
                        </div>
                        {c.totalVideos > 0 && (
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, color: '#536348', letterSpacing: '0.1em' }}>
                            {Math.round((c.completedVideos / c.totalVideos) * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="btn-primary" onClick={addWeeklyTask}
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                </button>
              </div>
            </div>

            {weeklyTasks.length > 0 && (
              <div>
                <label className="label" style={{ marginBottom: 8, display: 'block' }}>
                  Weekly Tasks ({weeklyCompletedCount}/{weeklyTotalTasks} done)
                </label>
                <div style={{ maxHeight: 250, overflowY: 'auto', border: '2px solid #e9e9dd' }}>
                  {weeklyTasks.map((t, i) => (
                    <div key={t._id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderBottom: i < weeklyTasks.length - 1 ? '1px solid #e9e9dd' : 'none',
                      background: t.done ? '#f5f4e8' : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32,
                          background: t.done ? '#536348' : '#181f21',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <span className="material-symbols-outlined" style={{ color: '#fbfaee', fontSize: 18 }}>
                            {t.done ? 'check' : 'task_alt'}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14,
                          color: '#181f21', textDecoration: t.done ? 'line-through' : 'none',
                          opacity: t.done ? 0.5 : 1,
                        }}>
                          {t.videoId && t.courseId ? (
                            <Link to={`/courses/${t.courseId}/watch/${t.videoId}`}
                              style={{ color: 'inherit', textDecoration: 'inherit' }}
                              onClick={(e) => e.stopPropagation()}>
                              {t.text} <span style={{ fontSize: 12, opacity: 0.7 }}>↗</span>
                            </Link>
                          ) : t.text}
                        </span>
                      </div>
                      <button onClick={() => deleteWeeklyTask(t._id)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#ba1a1a', opacity: 0.4, transition: 'opacity 0.15s',
                          display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={() => setShowWeeklyModal(false)}
              style={{ width: '100%', marginTop: 8 }}>
              DONE
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
