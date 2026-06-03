import { useState, useEffect, useCallback } from 'react';
import { goalsAPI } from '../api';
import { Spinner, EmptyState } from '../components/UI';
import { useToast } from '../hooks/useToast';

/* ─── Task checkbox ──────────────────────────────────────────────────────── */
function TaskCheckbox({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <div style={{
        width: 24, height: 24,
        border: '2px solid #181f21',
        background: checked ? '#536348' : '#fbfaee',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: '#fbfaee',
        transition: 'all 0.15s',
      }}>
        {checked && '✓'}
      </div>
    </label>
  );
}

/* ─── Plan Your Day ──────────────────────────────────────────────────────── */
export default function PlanYourDay() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  // Goals
  const [dailyGoal, setDailyGoal] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState('');
  const [dailySaved, setDailySaved] = useState(true);
  const [weeklySaved, setWeeklySaved] = useState(true);

  // Tasks (local state — persisted in localStorage)
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  // Goal history
  const [historyTab, setHistoryTab] = useState('daily');
  const [history, setHistory] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('learnr_plan') || '{}');
      const today = new Date().toISOString().slice(0, 10);
      if (saved.date === today) {
        setDailyGoal(saved.dailyGoal || '');
        setWeeklyGoal(saved.weeklyGoal || '');
        setTasks(saved.tasks || []);
      }
      const hist = JSON.parse(localStorage.getItem('learnr_goal_history') || '[]');
      setHistory(hist);
    } catch {}
    setLoading(false);
  }, []);

  // Save to localStorage on change
  const persist = useCallback((dg, wg, ts) => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('learnr_plan', JSON.stringify({
      date: today, dailyGoal: dg, weeklyGoal: wg, tasks: ts,
    }));
  }, []);

  const updateDailyGoal = (val) => {
    setDailyGoal(val);
    setDailySaved(false);
    persist(val, weeklyGoal, tasks);
    setTimeout(() => setDailySaved(true), 600);
  };

  const updateWeeklyGoal = (val) => {
    setWeeklyGoal(val);
    setWeeklySaved(false);
    persist(dailyGoal, val, tasks);
    setTimeout(() => setWeeklySaved(true), 600);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const ts = [...tasks, { id: Date.now(), text: newTask.trim(), done: false, course: '' }];
    setTasks(ts);
    setNewTask('');
    persist(dailyGoal, weeklyGoal, ts);
    toast('Task added ✓');
  };

  const toggleTask = (id) => {
    const ts = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(ts);
    persist(dailyGoal, weeklyGoal, ts);
  };

  const deleteTask = (id) => {
    const ts = tasks.filter((t) => t.id !== id);
    setTasks(ts);
    persist(dailyGoal, weeklyGoal, ts);
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Archive today's goal to history
  const archiveDay = () => {
    if (!dailyGoal.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const status = taskProgress === 100 ? 'ACHIEVED' : taskProgress >= 50 ? `PARTIAL (${taskProgress}%)` : 'MISSED';
    const entry = { date: today, goal: dailyGoal, status, type: 'daily' };
    const updated = [entry, ...history].slice(0, 30);
    setHistory(updated);
    localStorage.setItem('learnr_goal_history', JSON.stringify(updated));
    // Reset daily
    setDailyGoal('');
    setTasks([]);
    persist('', weeklyGoal, []);
    toast('Day archived ✓');
  };

  if (loading) return <Spinner pad={100} />;

  const filteredHistory = history.filter((h) => h.type === historyTab);

  return (
    <div className="page-wrapper fade-up">
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">Plan Your Day</h1>
        <p className="page-sub">Set goals, track tasks, stay focused</p>
      </div>

      {/* ── Goal Setting Section ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Daily Goal Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-header" style={{ margin: 0 }}>Daily Goal</h2>
            <span className="label-caps" style={{
              color: taskProgress === 100 ? '#536348' : '#003365',
              fontSize: 10,
            }}>
              STATUS: {taskProgress === 100 ? 'COMPLETE' : 'IN PROGRESS'}
            </span>
          </div>
          <input
            className="input"
            type="text"
            placeholder="What will you accomplish today?"
            value={dailyGoal}
            onChange={(e) => updateDailyGoal(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label-caps" style={{ color: '#747879' }}>Progress</span>
              <span className="label-caps" style={{ color: '#181f21' }}>{completedCount}/{tasks.length} TASKS</span>
            </div>
            {/* Segmented progress */}
            <div style={{
              height: 20, width: '100%', background: '#e9e9dd',
              border: '2px solid #181f21', display: 'flex', padding: 2,
            }}>
              {tasks.length > 0 ? tasks.map((t, i) => (
                <div key={t.id} style={{
                  flex: 1, height: '100%',
                  background: t.done ? '#536348' : '#e9e9dd',
                  borderRight: i < tasks.length - 1 ? '2px solid #fbfaee' : 'none',
                  transition: 'background 0.3s',
                }} />
              )) : (
                <div style={{ width: '100%', height: '100%', background: '#e9e9dd' }} />
              )}
            </div>
          </div>
        </div>

        {/* Weekly Goal Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-header" style={{ margin: 0 }}>Weekly Goal</h2>
            <span className="label-caps" style={{ color: '#003365', fontSize: 10 }}>
              MILESTONE
            </span>
          </div>
          <input
            className="input"
            type="text"
            placeholder="Set your weekly objective..."
            value={weeklyGoal}
            onChange={(e) => updateWeeklyGoal(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label-caps" style={{ color: '#747879' }}>Weekly Progress</span>
              <span className="label-caps" style={{ color: '#181f21' }}>Track manually</span>
            </div>
            <div style={{
              height: 20, width: '100%', background: '#e9e9dd',
              border: '2px solid #181f21', position: 'relative', overflow: 'hidden', padding: 2,
            }}>
              <div style={{
                height: '100%', background: '#baccab', width: '0%',
                borderRight: '2px solid #181f21', transition: 'width 0.5s',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Task Workspace ────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32, borderWidth: '4px' }}>
        {/* Header bar */}
        <div style={{
          background: '#181f21', padding: '16px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 20, fontWeight: 700, color: '#fbfaee', margin: 0,
          }}>Today's Learning Tasks</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              style={{
                width: 260, padding: '8px 12px', fontSize: 13,
                background: '#fbfaee', border: '2px solid #fbfaee',
              }}
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            />
            <button
              onClick={addTask}
              style={{
                background: '#536348', color: '#fbfaee',
                border: 'none', padding: '8px 16px', cursor: 'pointer',
                fontFamily: "'Space Mono', monospace",
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3c4b32'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#536348'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              ADD TASK
            </button>
          </div>
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
            <p style={{ color: '#747879', fontSize: 14, fontFamily: "'Public Sans', sans-serif" }}>
              No tasks yet. Add your first learning task above.
            </p>
          </div>
        ) : (
          <div>
            {tasks.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 24px', borderBottom: i < tasks.length - 1 ? '2px solid #181f21' : 'none',
                  transition: 'background 0.15s',
                }}
                className="task-row"
                onMouseEnter={(e) => e.currentTarget.style.background = '#efeee3'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <TaskCheckbox checked={t.done} onChange={() => toggleTask(t.id)} />
                  <div>
                    <p style={{
                      fontFamily: "'Public Sans', sans-serif",
                      fontWeight: 700, color: '#181f21', margin: 0, fontSize: 15,
                      textDecoration: t.done ? 'line-through' : 'none',
                      opacity: t.done ? 0.5 : 1,
                    }}>
                      {t.text}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(t.id)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#ba1a1a', opacity: 0.4, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {tasks.length > 0 && (
          <div style={{
            padding: '12px 24px', background: '#f5f4e8',
            borderTop: '2px solid #181f21',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span className="label-caps" style={{ color: '#747879', fontSize: 10 }}>
              {completedCount} of {tasks.length} complete
            </span>
            <button
              onClick={archiveDay}
              className="label-caps"
              style={{
                color: '#181f21', background: 'transparent', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4,
                fontSize: 11,
              }}
            >
              ARCHIVE & RESET DAY
            </button>
          </div>
        )}
      </div>

      {/* ── Goal History & Records ────────────────────────────────────── */}
      <div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 32, borderBottom: '2px solid rgba(24,31,33,0.15)', marginBottom: 20 }}>
          <button
            onClick={() => setHistoryTab('daily')}
            className="label-caps"
            style={{
              paddingBottom: 12, background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: historyTab === 'daily' ? '4px solid #181f21' : '4px solid transparent',
              color: historyTab === 'daily' ? '#181f21' : '#747879',
              transition: 'all 0.15s',
            }}
          >
            PAST DAILY GOALS
          </button>
          <button
            onClick={() => setHistoryTab('weekly')}
            className="label-caps"
            style={{
              paddingBottom: 12, background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: historyTab === 'weekly' ? '4px solid #181f21' : '4px solid transparent',
              color: historyTab === 'weekly' ? '#181f21' : '#747879',
              transition: 'all 0.15s',
            }}
          >
            PAST WEEKLY GOALS
          </button>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#747879', fontSize: 14, fontFamily: "'Public Sans', sans-serif" }}>
              No past {historyTab} goals yet. Archive your first day to see history here.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#e4e3d7', borderBottom: '2px solid #181f21' }}>
                  <th className="label-caps" style={{ padding: 16, fontSize: 11 }}>Date</th>
                  <th className="label-caps" style={{ padding: 16, fontSize: 11 }}>Goal Description</th>
                  <th className="label-caps" style={{ padding: 16, fontSize: 11, textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((h, i) => {
                  const statusBg = h.status === 'ACHIEVED' ? '#a8ba9a'
                    : h.status.startsWith('PARTIAL') ? '#baccab'
                    : '#ffdad6';
                  const statusColor = h.status === 'ACHIEVED' ? '#ffffff'
                    : h.status.startsWith('PARTIAL') ? '#3c4b32'
                    : '#93000a';

                  return (
                    <tr key={i} style={{ borderBottom: i < filteredHistory.length - 1 ? '2px solid #efeee3' : 'none' }}>
                      <td className="label-caps" style={{ padding: 16, fontSize: 11, color: '#747879' }}>
                        {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                      </td>
                      <td style={{
                        padding: 16, fontFamily: "'Public Sans', sans-serif",
                        fontWeight: 700, color: '#181f21',
                      }}>
                        {h.goal}
                      </td>
                      <td style={{ padding: 16, textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 12px',
                          background: statusBg, color: statusColor,
                          fontFamily: "'Space Mono', monospace",
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                          border: '2px solid #181f21',
                        }}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
