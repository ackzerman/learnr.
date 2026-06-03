import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, analyticsAPI } from '../api';
import { fmt, fmtDate } from '../utils';
import { Spinner, Heatmap, HeatmapLegend } from '../components/UI';
import { useAuth } from '../hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from 'recharts';

const VIEWS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const TT_STYLE = {
  contentStyle: { background: '#ffffff', border: '2px solid #181f21', borderRadius: 0, color: '#181f21', fontSize: 13, fontFamily: "'Public Sans', sans-serif" },
  cursor: { fill: 'rgba(83,99,72,0.06)' },
};

// Monday-start week-aggregation helper
const getWeekStart = (dateStr) => {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday
  const diff = date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Monday
  const monday = new Date(year, month, diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};


export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('weekly');
  const [pageOffset, setPageOffset] = useState(0);

  const handleViewChange = (v) => {
    setView(v);
    setPageOffset(0);
  };

  useEffect(() => {
    Promise.all([
      authAPI.me(),
      analyticsAPI.summary(),
      analyticsAPI.heatmap('year'),
    ])
      .then(([u, s, h]) => {
        setUser(u.user);
        setSummary(s);
        setHeatmap(h.heatmap || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) return <Spinner pad={80} />;
  if (!user) return <p style={{ color: '#747879', textAlign: 'center', padding: 60 }}>Could not load profile.</p>;

  /* ── Derived stats ──────────────────────────────────────────────── */
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const totalVideos = summary?.daily?.reduce((a, d) => a + d.videosWatched, 0) || 0;
  const totalSec = summary?.daily?.reduce((a, d) => a + d.totalSeconds, 0) || 0;
  const totalHrs = Math.floor(totalSec / 3600);
  const totalMins = Math.floor((totalSec % 3600) / 60);

  // 1. Daily Data (all daily records)
  const dailyData = (summary?.daily || []).map((d) => ({
    name: d.date.slice(5),
    videos: d.videosWatched,
    hours: Math.round((d.totalSeconds / 3600) * 10) / 10,
  }));

  // 2. Weekly Data (aggregated from daily)
  const weeklyGroups = {};
  (summary?.daily || []).forEach((d) => {
    const weekStart = getWeekStart(d.date);
    if (!weeklyGroups[weekStart]) {
      weeklyGroups[weekStart] = {
        videos: 0,
        seconds: 0,
      };
    }
    weeklyGroups[weekStart].videos += d.videosWatched;
    weeklyGroups[weekStart].seconds += d.totalSeconds;
  });

  const weeklyData = Object.keys(weeklyGroups)
    .sort()
    .map((weekStart) => ({
      name: weekStart.slice(5), // MM-DD
      videos: weeklyGroups[weekStart].videos,
      hours: Math.round((weeklyGroups[weekStart].seconds / 3600) * 10) / 10,
    }));

  // 3. Monthly Data (all monthly records)
  const monthlyData = (summary?.monthly || []).map((m) => ({
    name: m.month,
    videos: m.videosWatched,
    hours: Math.round((m.totalSeconds / 3600) * 10) / 10,
  }));

  const chartData = {
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData,
  };

  const PAGE_SIZES = {
    daily: 7,
    weekly: 8,
    monthly: 6,
  };

  const activeDataFull = chartData[view] || [];
  const pageSize = PAGE_SIZES[view] || 7;
  const totalItems = activeDataFull.length;

  const maxOffset = Math.max(0, Math.ceil(totalItems / pageSize) - 1);
  const safeEndIndex = Math.min(totalItems, totalItems - pageOffset * pageSize);
  const safeStartIndex = Math.max(0, safeEndIndex - pageSize);

  const activeData = activeDataFull.slice(safeStartIndex, safeEndIndex);

  const getRangeLabel = () => {
    if (activeData.length === 0) return '';
    const first = activeData[0].name;
    const last = activeData[activeData.length - 1].name;
    return `${first} to ${last}`;
  };

  return (
    <div className="page-wrapper fade-up">
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 9fr',
        gap: 24,
      }}>

        {/* ═══════════════════ LEFT PROFILE COLUMN ═══════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* User Profile Card */}
          <div style={{
            background: '#ffffff',
            border: '4px solid #181f21',
            padding: 24,
            boxShadow: '4px 4px 0px 0px #181f21',
          }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{
                width: '100%', aspectRatio: '1/1',
                background: '#d0e3c1',
                border: '2px solid #181f21',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 64, fontWeight: 800, color: '#181f21',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '-0.02em',
                filter: 'grayscale(0)',
                transition: 'all 0.5s',
              }}>
                {initials}
              </div>
              {/* Edit icon badge */}
              <div style={{
                position: 'absolute', bottom: -8, right: -8,
                background: '#d6e8c6',
                border: '2px solid #181f21',
                padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#181f21' }}>edit</span>
              </div>
            </div>

            {/* Name + handle */}
            <div style={{ marginBottom: 16 }}>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24, fontWeight: 600, color: '#181f21',
                margin: '0 0 4px', lineHeight: 1.3,
              }}>{user.name}</h2>
              <p className="label-caps" style={{ color: '#434749', margin: 0 }}>
                @{user.name.toLowerCase().replace(/\s+/g, '')}
              </p>
            </div>

            {/* Divider + meta rows */}
            <div style={{ borderTop: '2px solid #c3c7c8', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#434749' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>location_on</span>
                <span className="label-caps">{user.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#434749' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>calendar_today</span>
                <span className="label-caps">Joined {fmtDate(user.createdAt)}</span>
              </div>
            </div>

            {/* Edit Profile button */}
            <button
              style={{
                width: '100%', marginTop: 16, padding: '12px 0',
                background: '#fbfaee', color: '#181f21',
                border: '2px solid #181f21',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 16, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d6e8c6'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fbfaee'}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(4px, 4px)'; e.currentTarget.style.boxShadow = 'none'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
            >
              Edit Profile
            </button>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
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
            Sign out
          </button>
        </div>

        {/* ═══════════════════ RIGHT MAIN COLUMN ═══════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Metric Cards Row ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {/* Total Videos Watched */}
            <div
              style={{
                background: '#fbfaee',
                border: '4px solid #181f21',
                padding: 24,
                boxShadow: '4px 4px 0px 0px #181f21',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d6e8c6'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fbfaee'}
            >
              <p className="label-caps" style={{ color: '#434749', margin: '0 0 8px' }}>Total Videos Watched</p>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 48, fontWeight: 700, color: '#181f21',
                margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1,
              }}>{totalVideos}</p>
            </div>

            {/* Total Watch Time */}
            <div
              style={{
                background: '#fbfaee',
                border: '4px solid #181f21',
                padding: 24,
                boxShadow: '4px 4px 0px 0px #181f21',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d5e3ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fbfaee'}
            >
              <p className="label-caps" style={{ color: '#434749', margin: '0 0 8px' }}>Total Watch Time</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 48, fontWeight: 700, color: '#181f21',
                  letterSpacing: '-0.02em', lineHeight: 1.1,
                }}>{totalHrs}</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 24, fontWeight: 600, color: '#181f21',
                }}>H</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 48, fontWeight: 700, color: '#181f21',
                  letterSpacing: '-0.02em', lineHeight: 1.1,
                }}>{totalMins}</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 24, fontWeight: 600, color: '#181f21',
                }}>M</span>
              </div>
            </div>

            {/* Streak Status */}
            <div style={{
              background: '#181f21',
              border: '4px solid #181f21',
              padding: 24,
              boxShadow: '4px 4px 0px 0px #181f21',
            }}>
              <p className="label-caps" style={{ color: '#959c9f', margin: '0 0 8px' }}>Streak Status</p>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24, fontWeight: 600, color: '#ffffff',
                margin: '0 0 4px', lineHeight: 1.3,
              }}>
                {user.streak} Days{' '}
                <span style={{ color: '#959c9f', fontSize: 16, fontFamily: "'Public Sans', sans-serif", fontWeight: 400, opacity: 0.6 }}>// Current</span>
              </p>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24, fontWeight: 600, color: '#d6e8c6',
                margin: 0, lineHeight: 1.3,
              }}>
                {user.streak} Days{' '}
                <span style={{ color: '#959c9f', fontSize: 16, fontFamily: "'Public Sans', sans-serif", fontWeight: 400, opacity: 0.6 }}>// All-time</span>
              </p>
            </div>
          </div>

          {/* ── Activity Heatmap ────────────────────────────────── */}
          <div style={{
            background: '#fbfaee',
            border: '4px solid #181f21',
            padding: 24,
            boxShadow: '4px 4px 0px 0px #181f21',
            overflowX: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 24, fontWeight: 600, color: '#181f21', margin: 0,
              }}>Activity Heatmap</h3>
              <HeatmapLegend />
            </div>
            <Heatmap data={heatmap} weeks={52} />
          </div>

          {/* ── Learning Breakdown (Recharts + Interval Filters) ───────────────── */}
          <div style={{
            background: '#fbfaee',
            border: '4px solid #181f21',
            padding: 24,
            boxShadow: '4px 4px 0px 0px #181f21',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 24, fontWeight: 600, color: '#181f21', margin: 0,
                }}>Learning Breakdown</h3>

                {/* Pagination Controls */}
                {activeDataFull.length > pageSize && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#efeee3', border: '2px solid #181f21', padding: '2px 8px' }}>
                    <button
                      onClick={() => setPageOffset(p => Math.min(maxOffset, p + 1))}
                      disabled={safeStartIndex === 0}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: safeStartIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: safeStartIndex === 0 ? 0.3 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 2,
                        color: '#181f21',
                      }}
                      title="Previous Period"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, fontWeight: 'bold' }}>chevron_left</span>
                    </button>

                    <span className="label-caps" style={{ fontSize: 11, color: '#434749', fontFamily: "'Space Mono', monospace" }}>
                      {getRangeLabel()}
                    </span>

                    <button
                      onClick={() => setPageOffset(p => Math.max(0, p - 1))}
                      disabled={pageOffset === 0}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: pageOffset === 0 ? 'not-allowed' : 'pointer',
                        opacity: pageOffset === 0 ? 0.3 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 2,
                        color: '#181f21',
                      }}
                      title="Next Period"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, fontWeight: 'bold' }}>chevron_right</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pill-tabs" style={{ width: 'auto' }}>
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    className={`pill-tab${view === v.id ? ' active' : ''}`}
                    onClick={() => handleViewChange(v.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {activeData.length === 0 ? (
              <p style={{ color: '#747879', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
                No data for this period yet.
              </p>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* Videos Chart */}
                  <div>
                    <p className="label-caps" style={{ color: '#747879', marginBottom: 10 }}>
                      Videos watched
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={activeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e3d7" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#747879', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#747879', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip {...TT_STYLE} formatter={(v) => [v, 'Videos']} />
                        <Bar dataKey="videos" fill="#536348" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Hours Chart */}
                  <div>
                    <p className="label-caps" style={{ color: '#747879', marginBottom: 10 }}>
                      Hours watched
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={activeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="sageGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#536348" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#536348" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e3d7" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#747879', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#747879', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT_STYLE} formatter={(v) => [`${v}h`, 'Hours']} />
                        <Area dataKey="hours" stroke="#003365" strokeWidth={2} fill="url(#sageGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Totals for this view */}
                <div style={{ display: 'flex', gap: 28, marginTop: 20, paddingTop: 16, borderTop: '2px solid #181f21', flexWrap: 'wrap' }}>
                  <div>
                    <p className="label-caps" style={{ color: '#747879', margin: '0 0 4px' }}>Period total</p>
                    <p style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: '#536348', fontSize: 20, fontWeight: 800, margin: 0,
                    }}>
                      {activeData.reduce((a, d) => a + d.videos, 0)} videos
                    </p>
                  </div>
                  <div>
                    <p className="label-caps" style={{ color: '#747879', margin: '0 0 4px' }}>Period hours</p>
                    <p style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: '#003365', fontSize: 20, fontWeight: 800, margin: 0,
                    }}>
                      {Math.round(activeData.reduce((a, d) => a + d.hours, 0) * 10) / 10}h
                    </p>
                  </div>
                  <div>
                    <p className="label-caps" style={{ color: '#747879', margin: '0 0 4px' }}>Avg per period</p>
                    <p style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: '#747879', fontSize: 20, fontWeight: 800, margin: 0,
                    }}>
                      {activeData.length > 0 ? Math.round(activeData.reduce((a, d) => a + d.videos, 0) / activeData.length * 10) / 10 : 0} videos
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
