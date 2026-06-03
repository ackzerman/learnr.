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

/* ─── Heatmap — sage-based color scale ─────────────────────────────────────── */
const heatColor = (c) => {
  if (c === 0) return '#efeee3';
  if (c === 1) return '#d0e3c1';
  if (c <= 3)  return '#a8ba9a';
  if (c <= 6)  return '#7a9a68';
  return '#536348';
};

export function Heatmap({ data = [], weeks = 13 }) {
  const map = {};
  data.forEach((d) => { map[d.date] = d.count ?? d.videosWatched ?? 0; });

  const days = [];
  const today = new Date();
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    days.push({ date: k, count: map[k] || 0 });
  }

  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const wdays = days.slice(w * 7, w * 7 + 7);
    cols.push(
      <div key={w} className="heatmap-col">
        {wdays.map((d) => (
          <div
            key={d.date}
            className="heatmap-day"
            title={`${d.date}: ${d.count} video${d.count !== 1 ? 's' : ''}`}
            style={{ background: heatColor(d.count) }}
          />
        ))}
      </div>
    );
  }
  return <div className="heatmap-grid">{cols}</div>;
}

export function HeatmapLegend() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span className="label-caps" style={{ fontSize: 10, color: '#747879' }}>Less</span>
      {[0, 1, 3, 5, 7].map((c) => (
        <div key={c} className="heatmap-day" style={{ background: heatColor(c) }} />
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

/* ─── Modal — retro with sage block shadow ─────────────────────────────────── */
export function Modal({ title, onClose, children, wide = false }) {
  return (
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
    </div>
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
