import { useState, useEffect, useCallback } from 'react';
import { analyticsAPI } from '../api';
import { fmt } from '../utils';
import { Spinner, StatCard, Heatmap, HeatmapLegend } from '../components/UI';
import { useToast } from '../hooks/useToast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from 'recharts';

const RANGES = [
  { id: '30d',  label: '30 days'   },
  { id: '90d',  label: '90 days'   },
  { id: 'year', label: 'This year' },
  { id: 'all',  label: 'All time'  },
];

const VIEWS = [
  { id: 'daily',   label: 'Daily'   },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly'  },
];

const TT_STYLE = {
  contentStyle: { background: '#ffffff', border: '2px solid #181f21', borderRadius: 0, color: '#181f21', fontSize: 13, fontFamily: "'Public Sans', sans-serif" },
  cursor: { fill: 'rgba(83,99,72,0.06)' },
};

export default function Analytics() {
  const toast = useToast();
  const [range, setRange]       = useState('30d');
  const [view, setView]         = useState('monthly');
  const [heatmap, setHeatmap]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [hmLoading, setHmLoading] = useState(false);

  // Load summary once
  useEffect(() => {
    analyticsAPI.summary()
      .then(setSummary)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Load heatmap on range change
  const loadHeatmap = useCallback(async (r) => {
    setHmLoading(true);
    try {
      const d = await analyticsAPI.heatmap(r);
      setHeatmap(d.heatmap || []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setHmLoading(false); }
  }, []);

  useEffect(() => { loadHeatmap(range); }, [range]);

  if (loading) return <Spinner pad={100} />;

  /* ── Derived data ──────────────────────────────────────────────────── */
  const totals = summary ? {
    videos: summary.daily?.reduce((a, d) => a + d.videosWatched, 0) || 0,
    hours:  Math.round((summary.daily?.reduce((a, d) => a + d.totalSeconds, 0) || 0) / 3600 * 10) / 10,
    months: summary.monthly?.length || 0,
    active: summary.daily?.filter((d) => d.videosWatched > 0).length || 0,
  } : { videos: 0, hours: 0, months: 0, active: 0 };

  const chartData = {
    daily: (summary?.daily || []).slice(-60).map((d) => ({
      name:   d.date.slice(5),
      videos: d.videosWatched,
      hours:  Math.round(d.totalSeconds / 3600 * 10) / 10,
    })),
    monthly: (summary?.monthly || []).map((m) => ({
      name:   m.month,
      videos: m.videosWatched,
      hours:  Math.round(m.totalSeconds / 3600 * 10) / 10,
    })),
    yearly: (summary?.yearly || []).map((y) => ({
      name:   y.year,
      videos: y.videosWatched,
      hours:  Math.round(y.totalSeconds / 3600 * 10) / 10,
    })),
  };

  const activeData = chartData[view] || [];
  const hmWeeks    = range === '30d' ? 5 : range === '90d' ? 13 : range === 'year' ? 26 : Math.min(52, Math.ceil(heatmap.length / 7) + 1);

  return (
    <div className="page-wrapper fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Analytics</h1>
        <p className="page-sub">Your complete learning statistics</p>
      </div>

      {/* Overall stats */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <StatCard label="Total videos"  value={totals.videos}          color="#181f21" sub="all time" />
        <StatCard label="Total hours"   value={`${totals.hours}h`}     color="#536348" sub="watch time" />
        <StatCard label="Active months" value={totals.months}          color="#003365" sub="with activity" />
        <StatCard label="Active days"   value={totals.active}          color="#747879" sub="with activity" />
      </div>

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 className="section-header">Activity heatmap</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                className={`range-tab${range === r.id ? ' active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {hmLoading ? <Spinner pad={40} /> : <Heatmap data={heatmap} weeks={hmWeeks} />}

        <div style={{ marginTop: 10 }}>
          <HeatmapLegend />
        </div>
      </div>

      {/* Charts */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
          <h3 className="section-header">Breakdown</h3>
          <div className="pill-tabs" style={{ width: 'auto' }}>
            {VIEWS.map((v) => (
              <button key={v.id} className={`pill-tab${view === v.id ? ' active' : ''}`} onClick={() => setView(v.id)}>
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
          <div className="grid-2">
            {/* Videos chart */}
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

            {/* Hours chart */}
            <div>
              <p className="label-caps" style={{ color: '#747879', marginBottom: 10 }}>
                Hours watched
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="sageGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#536348" stopOpacity={0.25} />
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
        )}

        {/* Totals for this view */}
        {activeData.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
