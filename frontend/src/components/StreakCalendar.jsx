import { useState, useEffect, useCallback } from 'react';
import { streakAPI } from '../api';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Full-month calendar grid with streak tracking.
 * Matches the Stitch "EduStream Home Page with Streak Calendar" design.
 *
 * @param {Object}  props
 * @param {Object}  props.streak       - Initial streak data { currentStreak, maxStreak, completedToday }
 * @param {boolean} [props.compact]    - If true, renders a smaller variant (used on Dashboard)
 */
export default function StreakCalendar({ streak, compact = false }) {
  const now = new Date();
  // Local time throughout — goal completions are keyed by local date strings,
  // so a UTC "today" would highlight the wrong cell in the evening/morning
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [monthDays, setMonthDays] = useState([]);
  const [loading, setLoading] = useState(false);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Format month string for API: YYYY-MM
  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;

  // Check if we're viewing the current month
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  // Load month data
  const loadMonth = useCallback(async (yr, mo) => {
    setLoading(true);
    try {
      const key = `${yr}-${String(mo).padStart(2, '0')}`;
      const res = await streakAPI.get(key);
      setMonthDays(res.days || []);
    } catch (err) {
      console.error('Failed to load month data:', err);
      setMonthDays([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    // Don't navigate past current month
    if (isCurrentMonth) return;
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar grid
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = `${monthNames[viewMonth - 1]} ${viewYear}`;

  // First day of month (0 = Sun) and total days in month
  const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  // Previous month overflow days
  const prevMonthDays = new Date(Date.UTC(viewYear, viewMonth - 1, 0)).getUTCDate();

  // Build completion set from monthDays
  const activeSet = new Set(monthDays.filter((d) => d.active).map((d) => d.date));

  // Find last active date
  const lastActive = monthDays.filter((d) => d.active).sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  // Build grid cells
  const cells = [];

  // Previous month overflow
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    cells.push({ type: 'overflow', dayNum, date: null });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isActive = activeSet.has(dateStr);
    const isToday = dateStr === todayStr;
    cells.push({ type: 'current', dayNum: d, date: dateStr, isActive, isToday });
  }

  // Next month overflow to fill the grid
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ type: 'overflow', dayNum: i, date: null });
    }
  }

  return (
    <div
      className="pixel-card"
      style={{
        background: '#fbfaee',
        padding: compact ? 20 : 24,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 12 : 16,
      }}
    >
      {/* ── Header: Month + Nav + Streak ───────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 16 }}>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: compact ? 20 : 24,
              fontWeight: 600,
              color: '#181f21',
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {monthLabel}
          </h2>
          <div style={{ display: 'flex', border: '2px solid #181f21' }}>
            <button
              onClick={prevMonth}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                border: 'none',
                borderRight: '2px solid #181f21',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e9e9dd')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_left
              </span>
            </button>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                border: 'none',
                cursor: isCurrentMonth ? 'not-allowed' : 'pointer',
                opacity: isCurrentMonth ? 0.35 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isCurrentMonth) e.currentTarget.style.background = '#e9e9dd';
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>

        {/* Streak counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: compact ? 20 : 24,
              fontWeight: 700,
              color: '#536348',
              lineHeight: 1,
            }}
          >
            {streak?.currentStreak ?? 0} Day{(streak?.currentStreak ?? 0) !== 1 ? 's' : ''}
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: '#434749',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            CURRENT STREAK
          </span>
        </div>
      </div>

      {/* ── Day Labels ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: compact ? 2 : 4,
          textAlign: 'center',
        }}
      >
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: '#747879',
              opacity: 0.5,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Calendar Grid ──────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          rowGap: compact ? 14 : 16,
          columnGap: compact ? 2 : 4,
          minHeight: loading ? 160 : 'auto',
          position: 'relative',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(251,250,238,0.7)',
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: '3px solid #c3c7c8',
                borderTopColor: '#181f21',
                animation: 'spin 0.75s linear infinite',
              }}
            />
          </div>
        )}
        {cells.map((cell, i) => {
          if (cell.type === 'overflow') {
            return (
              <div
                key={`o-${i}`}
                style={{
                  aspectRatio: compact ? 'unset' : '1',
                  height: compact ? 28 : 'auto',
                  width: compact ? 28 : 'auto',
                  margin: compact ? '0 auto' : undefined,
                  borderRadius: compact ? '50%' : 0,
                  border: '1px solid #c3c7c8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontFamily: "'Space Mono', monospace",
                  fontWeight: 700,
                  color: '#181f21',
                  opacity: 0.2,
                }}
              >
                {cell.dayNum}
              </div>
            );
          }

          const { isActive, isToday, dayNum } = cell;

          return (
            <div
              key={cell.date}
              style={{
                aspectRatio: compact ? 'unset' : '1',
                height: compact ? 28 : 'auto',
                width: compact ? 28 : 'auto',
                margin: compact ? '0 auto' : undefined,
                borderRadius: compact ? '50%' : 0,
                border: isToday
                  ? '3px solid #181f21'
                  : isActive
                    ? '2px solid #181f21'
                    : '1px solid #181f21',
                background: isActive ? '#d6e8c6' : '#fbfaee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {isActive ? (
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: compact ? 12 : 14,
                    fontWeight: 700,
                    color: '#536348',
                  }}
                >
                  check
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 700,
                    color: '#181f21',
                  }}
                >
                  {dayNum}
                </span>
              )}
            </div>
          );
        })}
      </div>


    </div>
  );
}
