import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { goalsAPI, coursesAPI } from '../api';
import { Spinner, Modal, LabelInput } from '../components/UI';
import { useToast } from '../hooks/useToast';

/* ─── Task checkbox — retro square ────────────────────────────────────────── */
function TaskCheckbox({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
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
        }}
      >
        {checked && '✓'}
      </div>
    </label>
  );
}

/* ─── Plan Your Day — Stitch Screen Layout ────────────────────────────────── */
export default function PlanYourDay() {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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

  // Modal
  const [showModal, setShowModal] = useState(false);

  // Today's date formatted
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [todayRes, courseRes] = await Promise.all([
          goalsAPI.getToday(),
          coursesAPI.list(1, 10),
        ]);
        const g = todayRes.goal;
        setGoal(g);
        setDailyGoal(g.description || '');
        setTasks(g.tasks || []);
        setCourses(courseRes.courses || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
  }, []);

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
      const res = await goalsAPI.toggleTask(taskId);
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
      const res = await goalsAPI.deleteTask(taskId);
      setGoal(res.goal);
      setTasks(res.goal.tasks);
      toast('Task removed');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const totalTasks = tasks.length;

  if (loading) return <Spinner pad={100} />;

  // Courses with progress for the "Active Course Progress" panel
  const activeCourses = courses
    .filter((c) => c.totalVideos > 0)
    .map((c) => ({
      ...c,
      progress: Math.round((c.completedVideos / c.totalVideos) * 100),
    }))
    .slice(0, 4);

  return (
    <div className="page-wrapper fade-up" style={{ paddingBottom: 80 }}>
      {/* ── Top Header Bar — Date + Nav + Add Goals ────────────── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 24,
              fontWeight: 600,
              color: '#181f21',
            }}
          >
            {todayFormatted}
          </span>
        </div>
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
      </div>

      {/* ── Daily Goals Section ────────────────────────────────── */}
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
                  No tasks yet. Click "Add Goals" to get started.
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
                {/* Slate top bar */}
                <div style={{ height: 16, background: '#181f21', width: '100%' }} />

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
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleTask(t._id)}
                    >
                      <TaskCheckbox checked={t.done} onChange={() => { }} />
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

      {/* ── Plan Your Week — 2-Column Layout ───────────────────── */}
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
            Plan Your Week
          </h2>
          <span className="label-caps" style={{ color: '#434749' }}>
            {dailyGoal || 'SET YOUR GOAL'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left: Active Course Progress*/}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Active Course Progress */}
            <div
              style={{
                background: '#fbfaee',
                border: '2px solid #181f21',
                padding: 24,
                boxShadow: '4px 4px 0 0 #181f21',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 24,
                  paddingLeft: 12,
                  borderLeft: '4px solid #181f21',
                  color: '#181f21',
                }}
              >
                Active Course Progress
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activeCourses.length === 0 ? (
                  <p
                    style={{
                      color: '#747879',
                      fontSize: 14,
                      fontFamily: "'Public Sans', sans-serif",
                      textAlign: 'center',
                      padding: 20,
                    }}
                  >
                    No active courses yet.{' '}
                    <span
                      style={{ color: '#536348', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigate('/courses')}
                    >
                      Browse courses
                    </span>
                  </p>
                ) : (
                  activeCourses.map((c) => (
                    <div key={c.courseId}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#181f21',
                          }}
                        >
                          {c.title}
                        </span>
                        <span className="label-caps" style={{ color: '#181f21' }}>
                          {c.progress}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 24,
                          width: '100%',
                          border: '2px solid #181f21',
                          position: 'relative',
                          overflow: 'hidden',
                          background: '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            background: '#536348',
                            width: `${c.progress}%`,
                            backgroundImage:
                              'linear-gradient(to right, #fbfaee 2px, transparent 2px)',
                            backgroundSize: '10% 100%',
                            borderRight: c.progress > 0 && c.progress < 100 ? '2px solid #181f21' : 'none',
                            transition: 'width 0.5s',
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Upcoming Videos / Daily Goal Input + Task Queue */}
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
                fontSize: 12,
                fontWeight: 700,
                color: '#959c9f',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              TODAY'S GOAL
            </span>

            <input
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontFamily: "'Public Sans', sans-serif",
                background: '#fbfaee',
                border: '2px solid #fbfaee',
                color: '#181f21',
                outline: 'none',
                marginBottom: 16,
              }}
              placeholder="What will you accomplish today?"
              value={dailyGoal}
              onChange={(e) => updateDailyGoal(e.target.value)}
            />

            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                color: '#959c9f',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              TASK QUEUE
            </span>

            {/* Task list in dark panel */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: 300,
                paddingRight: 4,
              }}
            >
              {tasks.length === 0 ? (
                <p
                  style={{
                    color: '#959c9f',
                    fontSize: 13,
                    fontFamily: "'Public Sans', sans-serif",
                    textAlign: 'center',
                    padding: '20px 0',
                  }}
                >
                  No tasks in queue
                </p>
              ) : (
                tasks.map((t, i) => (
                  <div
                    key={t._id}
                    style={{
                      borderBottom: i < tasks.length - 1 ? '1px solid #41484a' : 'none',
                      paddingBottom: 12,
                      marginBottom: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 15,
                        fontWeight: 600,
                        color: t.done ? '#959c9f' : '#fbfaee',
                        textDecoration: t.done ? 'line-through' : 'none',
                        transition: 'color 0.15s',
                        margin: 0,
                      }}
                    >
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
                    </p>
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
                      {t.done ? '✓ DONE' : `TASK ${String(i + 1).padStart(2, '0')}`}
                    </span>
                  </div>
                ))
              )}
            </div>
            

            {/* Add task inline */}
            <div style={{ marginTop: 'auto', paddingTop: 12, position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: 13,
                    fontFamily: "'Public Sans', sans-serif",
                    background: 'transparent',
                    border: '2px solid #fbfaee',
                    color: '#fbfaee',
                    outline: 'none',
                  }}
                  placeholder="Add a task..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTask();
                  }}
                />
                <button
                  type="button"
                  onClick={addTask}
                  style={{
                    background: '#fbfaee',
                    border: '2px solid #fbfaee',
                    color: '#181f21',
                    padding: '0 16px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ADD
                </button>
              </div>
              {!showModal && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#181f21',
                  border: '2px solid #fbfaee', borderBottom: 'none', zIndex: 10,
                  maxHeight: 180, overflowY: 'auto'
                }}>
                  {searchResults.map((v) => (
                    <div
                      key={v._id}
                      style={{ padding: '8px 12px', borderBottom: '1px solid #41484a', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                      onClick={() => {
                        setSelectedVideo(v);
                        setNewTask(v.title);
                        setSearchResults([]);
                      }}
                    >
                      <strong style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", color: '#fbfaee' }}>{v.title}</strong>
                      <span style={{ fontSize: 11, color: '#959c9f' }}>{v.courseTitle}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>



      {/* ── Add Goals Modal ────────────────────────────────────── */}
      {showModal && (
        <Modal title="Add Goal for Today" onClose={() => setShowModal(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Goal description */}
            <LabelInput
              label="Daily Goal Description"
              placeholder="What will you accomplish today?"
              value={dailyGoal}
              onChange={(e) => updateDailyGoal(e.target.value)}
            />

            {/* Add task */}
            <div>
              <label className="label" style={{ marginBottom: 8, display: 'block' }}>Add a Learning Task</label>
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
    </div>
  );
}
