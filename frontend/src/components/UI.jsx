import { useState } from 'react';
import { pct } from '../utils';

/* ─── Spinner ──────────────────────────────────────────────────────────────── */
export function Spinner({ size = 32, pad = 60 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: pad }}>
      <div style={{
        width: size, height: size, borderRadius: 0,
        border: '3px solid #c3c7c8', borderTopColor: '#181f21',
        animation: 'spin 0.75s linear infinite',
      }} />
    </div>
  );
}

/* ─── ErrBox ───────────────────────────────────────────────────────────────── */
export function ErrBox({ msg }) {
  if (!msg) return null;
  return <div className="err-box">⚠ {msg}</div>;
}

/* ─── Progress bar — segmented retro style ─────────────────────────────────── */
export function ProgressBar({ value, color = '#536348', height = 4 }) {
  return (
    <div className="progress-bar" style={{ height: height + 4 }}>
      <div className="progress-fill" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

/* ─── Heatmap — sage-based color scale (by hours watched) ──────────────────── */
const heatColor = (hours) => {
  if (hours === 0)  return '#efeee3';
  if (hours < 0.5)  return '#d0e3c1';
  if (hours < 1)    return '#a8ba9a';
  if (hours < 2)    return '#7a9a68';
  return '#536348';
};

export function Heatmap({ data = [], weeks = 13, mode = 'rolling', year }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const map = {};
  data.forEach((d) => {
    const secs = d.totalSeconds ?? 0;
    map[d.date] = secs / 3600;
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let monthBlocks;

  if (mode === 'year' && year) {
    // ── Full calendar year mode (Jan–Dec) ──────────────────────────
    const yr = year;
    const isCurrentYear = yr === today.getUTCFullYear();

    const monthKeys = [];
    for (let m = 0; m < 12; m++) {
      // For current year, only show months up to the current month
      if (isCurrentYear && m > today.getUTCMonth()) break;
      monthKeys.push({ year: yr, month: m });
    }

    monthBlocks = monthKeys.map(({ year: y, month }) => {
      const daysInMonth = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
      const cols = [];
      let currentCol = new Array(7).fill(null);

      const lastDay = (isCurrentYear && month === today.getUTCMonth())
        ? today.getUTCDate()
        : daysInMonth;

      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(Date.UTC(y, month, day));
        const dow = d.getUTCDay();
        const k = d.toISOString().slice(0, 10);

        if (dow === 0 && day > 1) {
          cols.push(currentCol);
          currentCol = new Array(7).fill(null);
        }

        currentCol[dow] = { date: k, hours: map[k] || 0 };
      }
      cols.push(currentCol);

      return { year: y, month, cols };
    });
  } else {
    // ── Rolling weeks mode (original behavior) ──────────────────────
    const total = weeks * 7;
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (total - 1));

    // Collect unique year-months in the range
    const monthKeys = [];
    const seen = new Set();
    for (let i = 0; i < total; i++) {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 7);
      if (!seen.has(key)) {
        seen.add(key);
        monthKeys.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
      }
    }

    // Drop the first month if it duplicates the current month from a prior year
    const curMonth = today.getUTCMonth();
    const curYear = today.getUTCFullYear();
    if (monthKeys.length > 1 && monthKeys[0].month === curMonth && monthKeys[0].year < curYear) {
      monthKeys.shift();
    }

    monthBlocks = monthKeys.map(({ year: y, month }) => {
      const daysInMonth = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
      const cols = [];
      let currentCol = new Array(7).fill(null);

      const todayStr = today.toISOString().slice(0, 10);
      const lastDay = (y === today.getUTCFullYear() && month === today.getUTCMonth())
        ? today.getUTCDate()
        : daysInMonth;

      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(Date.UTC(y, month, day));
        const dow = d.getUTCDay();
        const k = d.toISOString().slice(0, 10);

        if (dow === 0 && day > 1) {
          cols.push(currentCol);
          currentCol = new Array(7).fill(null);
        }

        currentCol[dow] = { date: k, hours: map[k] || 0 };
      }
      cols.push(currentCol);

      return { year: y, month, cols };
    });
  }

  const CELL = 12;
  const GAP = 3;

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
      {monthBlocks.map((block, bi) => (
        <div key={bi} style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {/* Month label */}
          <span style={{
            fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700,
            color: '#747879', letterSpacing: '0.05em', textTransform: 'uppercase',
            textAlign: 'center',
          }}>
            {MONTHS[block.month]}
          </span>
          {/* Calendar grid — columns are weeks, rows are days of week (Sun–Sat) */}
          <div style={{ display: 'flex', gap: GAP }}>
            {block.cols.map((col, ci) => (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {col.map((cell, ri) => (
                  cell ? (
                    <div
                      key={cell.date}
                      className="heatmap-day"
                      title={`${cell.date}: ${cell.hours >= 1 ? Math.floor(cell.hours) + 'h ' + Math.round((cell.hours % 1) * 60) + 'm' : Math.round(cell.hours * 60) + 'm'} watched`}
                      style={{ background: heatColor(cell.hours) }}
                    />
                  ) : (
                    <div key={ri} style={{ width: CELL, height: CELL, flexShrink: 0 }} />
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeatmapYearSelector({ selectedYear, years = [], onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Selected year button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#efeee3', border: '2px solid #181f21', padding: '6px 14px',
          fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
          color: '#181f21', cursor: 'pointer', letterSpacing: '0.05em',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#d0e3c1'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#efeee3'}
      >
        {selectedYear}
        <span className="material-symbols-outlined" style={{
          fontSize: 16, transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>expand_more</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#ffffff', border: '2px solid #181f21',
          boxShadow: '4px 4px 0px 0px #181f21', zIndex: 50,
          minWidth: 100, animation: 'fadeIn 0.12s ease',
        }}>
          {years.map((yr) => (
            <button
              key={yr}
              onClick={() => { onChange(yr); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                background: yr === selectedYear ? '#d0e3c1' : 'transparent',
                border: 'none', borderBottom: '1px solid #e4e3d7',
                fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
                color: '#181f21', cursor: 'pointer', textAlign: 'left',
                letterSpacing: '0.05em', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (yr !== selectedYear) e.currentTarget.style.background = '#f5f4e8'; }}
              onMouseLeave={(e) => { if (yr !== selectedYear) e.currentTarget.style.background = 'transparent'; }}
            >
              {yr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span className="label-caps" style={{ fontSize: 10, color: '#747879' }}>Less</span>
      {[0, 0.25, 0.75, 1.5, 3].map((h) => (
        <div key={h} className="heatmap-day" style={{ background: heatColor(h) }} />
      ))}
      <span className="label-caps" style={{ fontSize: 10, color: '#747879' }}>More</span>
    </div>
  );
}

/* ─── StatCard — retro with block shadow ───────────────────────────────────── */
export function StatCard({ label, value, color = '#536348', sub }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <p className="label-caps" style={{ color: '#747879', margin: '0 0 8px' }}>{label}</p>
      <p style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 28, fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em',
      }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#c3c7c8', margin: '4px 0 0', fontFamily: "'Public Sans', sans-serif" }}>{sub}</p>}
    </div>
  );
}

import ReactDOM from 'react-dom';

/* ─── Modal — retro with sage block shadow ─────────────────────────────────── */
export function Modal({ title, onClose, children, wide = false }) {
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-box${wide ? ' wide' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 20, fontWeight: 700, color: '#181f21',
          }}>{title}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18, border: '2px solid #181f21' }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ─── LabelInput ───────────────────────────────────────────────────────────── */
export function LabelInput({ label, textarea = false, hint, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="label">{label}</label>
      {textarea
        ? <textarea className="input" {...props} />
        : <input className="input" {...props} />
      }
      {hint && <p style={{ fontSize: 12, color: '#747879', margin: 0, fontFamily: "'Public Sans', sans-serif" }}>{hint}</p>}
    </div>
  );
}

/* ─── CourseSourceBadge ────────────────────────────────────────────────────── */
export function CourseBadge({ source }) {
  return source === 'youtube'
    ? <span className="badge-yt">▶ YouTube</span>
    : <span className="badge-manual">✏ Manual</span>;
}

/* ─── VideoProgress square — retro index number ────────────────────────────── */
export function VideoCircle({ index, completed, active }) {
  const bg = completed ? '#536348' : active ? '#181f21' : '#efeee3';
  const color = completed ? '#fbfaee' : active ? '#fbfaee' : '#747879';
  const borderColor = '#181f21';
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 0, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color, fontSize: completed ? 13 : 12, fontWeight: 700,
      border: `2px solid ${borderColor}`,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {completed ? '✓' : index + 1}
    </div>
  );
}

/* ─── Empty state ──────────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, sub, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <h3 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#181f21', fontSize: 20, fontWeight: 700, marginBottom: 8,
      }}>{title}</h3>
      {sub && <p style={{ color: '#747879', fontSize: 14, marginBottom: 20, fontFamily: "'Public Sans', sans-serif" }}>{sub}</p>}
      {action && <button className="btn-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

/* ─── Section header row ───────────────────────────────────────────────────── */
export function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, height: 28, background: '#181f21' }} />
        <h3 className="section-header">{title}</h3>
      </div>
      {action && (
        <span onClick={onAction} className="label-caps" style={{ color: '#536348', cursor: 'pointer' }}>
          {action}
        </span>
      )}
    </div>
  );
}

/* ─── Tag Editor — inline add/remove tags ──────────────────────────────── */
export function TagEditor({ tags = [], onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue]   = useState('');

  const addTag = () => {
    const t = value.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onUpdate([...tags, t]);
    }
    setValue('');
    setAdding(false);
  };

  const removeTag = (tag) => {
    onUpdate(tags.filter((t) => t !== tag));
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Escape') { setValue(''); setAdding(false); }
  };

  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="tag-editable">
          {t}
          <button className="tag-remove" onClick={() => removeTag(t)} title={`Remove "${t}"`}>×</button>
        </span>
      ))}
      {adding ? (
        <input
          className="tag-add-input"
          autoFocus
          placeholder="tag name…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addTag}
        />
      ) : (
        <button className="tag-add-btn" onClick={() => setAdding(true)}>+ tag</button>
      )}
    </div>
  );
}

/* ─── Tag Filter Bar — clickable filter chips ──────────────────────────── */
export function TagFilterBar({ allTags, activeTags, onToggle }) {
  if (!allTags || allTags.length === 0) return null;
  return (
    <div className="tag-filter-bar">
      <span className="label-caps" style={{ color: '#747879', marginRight: 4 }}>Filter:</span>
      {allTags.map((t) => (
        <button
          key={t}
          className={`tag-chip${activeTags.includes(t) ? ' active' : ''}`}
          onClick={() => onToggle(t)}
        >
          {t}
          {activeTags.includes(t) && <span style={{ fontSize: 10 }}>✕</span>}
        </button>
      ))}
      {activeTags.length > 0 && (
        <button
          className="tag-chip"
          style={{ color: '#747879' }}
          onClick={() => activeTags.forEach(onToggle)}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
