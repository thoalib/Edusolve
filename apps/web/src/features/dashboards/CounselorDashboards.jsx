import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { toLocalISO } from '../../lib/dateUtils.js';

/* ═══════ Styles ═══════ */
const CHART_STYLES = `
  .dashboard-charts .flex-row-desktop {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 20px;
  }
  .dashboard-charts .flex-2 { flex: 2; min-width: 300px; }
  .dashboard-charts .flex-1 { flex: 1; min-width: 250px; }
  
  .dashboard-charts .chart-container {
    height: 220px;
    padding: 20px 0 35px;
    position: relative;
    margin-top: 10px;
  }
  .dashboard-charts .line-chart-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .dashboard-charts .chart-val-tooltip-floating {
    position: absolute;
    background: #1e293b;
    color: #fff;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translate(-50%, -100%);
    margin-top: -12px;
    transition: opacity 0.2s, transform 0.2s;
  }
  .dashboard-charts .chart-val-tooltip-floating::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid #1e293b;
  }
  .dashboard-charts .chart-tooltip-date {
    display: block;
    font-size: 10px;
    color: #94a3b8;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .dashboard-charts .chart-tooltip-val {
    display: block;
    font-size: 14px;
    font-weight: 700;
  }

  .dashboard-charts .chart-point {
    fill: #4338ca;
    stroke: #fff;
    stroke-width: 2px;
    transition: r 0.2s;
    cursor: pointer;
  }
  .dashboard-charts .chart-point:hover {
    r: 6;
  }
  .dashboard-charts .chart-line {
    fill: none;
    stroke: #4338ca;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .dashboard-charts .chart-area {
    fill: url(#cHeadGradient);
    opacity: 0.2;
  }
  
  .dashboard-charts .chart-label-x {
    position: absolute;
    bottom: -10px;
    transform: translateX(-50%);
    font-size: 10px;
    color: #64748b;
    font-weight: 500;
  }
  
  .dashboard-charts .chart-axis-x {
    stroke: #e5e7eb;
    stroke-width: 2px;
  }
  .dashboard-charts .chart-grid-line {
    stroke: #e5e7eb;
    stroke-width: 1px;
    stroke-dasharray: 4;
  }

  @media (max-width: 768px) {
    .dashboard-charts .flex-2, .dashboard-charts .flex-1 { flex: 1 1 100%; }
  }
`;

/* ═══════ Helpers ═══════ */
function getThisMonthRange() {
  const now = new Date();
  return {
    from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

/* ═══════ Reusable Components ═══════ */
function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`card stat-card ${tone}`}>
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

export function DashboardDateFilter({ onChange, initial }) {
  const [mode, setMode] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  function handleMode(m) {
    setMode(m);
    const now = new Date();
    if (m === 'all') {
      onChange({ from: '', to: '' });
    } else if (m === 'this_month') {
      onChange({
        from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      });
    } else if (m === 'last_month') {
      onChange({
        from: toLocalISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 0))
      });
    }
  }

  const pillStyle = (active) => ({
    padding: '6px 16px',
    borderRadius: '20px',
    border: active ? '2px solid #4338ca' : '1px solid #d1d5db',
    background: active ? '#eef2ff' : '#fff',
    color: active ? '#4338ca' : '#374151',
    fontWeight: active ? 700 : 500,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  });

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', marginBottom: '16px', overflowX: 'auto' }}>

      {[
        { key: 'all', label: 'All' },
        { key: 'this_month', label: 'This Month' },
        { key: 'last_month', label: 'Last Month' },
        { key: 'custom', label: 'Custom' }
      ].map(opt => (
        <button key={opt.key} type="button" onClick={() => handleMode(opt.key)} style={{ ...pillStyle(mode === opt.key), whiteSpace: 'nowrap' }}>
          {opt.label}
        </button>
      ))}
      {mode === 'custom' && (
        <>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minWidth: '130px' }} />
          <span style={{ color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minWidth: '130px' }} />
          <button type="button" onClick={() => { if (customFrom && customTo) onChange({ from: customFrom, to: customTo }); }}
            style={{ padding: '6px 16px', background: '#4338ca', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Apply
          </button>
        </>
      )}
    </div>
  );
}

function LeadTypeSelect({ value, onChange, leadTypes, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', ...style }}>
      <option value="all">All Lead Types</option>
      {leadTypes.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

/* ═══════ Counselor Dashboard ═══════ */
export function CounselorDashboardPage({ targetUserId }) {
  const [items, setItems] = useState([]);
  const [cProfile, setCProfile] = useState(null);
  const [allCProfiles, setAllCProfiles] = useState([]);
  const [cLevels, setCLevels] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [attendanceData, setAttendanceData] = useState(null);
  const [workingDays, setWorkingDays] = useState(26);
  const [counselorsList, setCounselorsList] = useState([]);
  const [dateRange, setDateRange] = useState(getThisMonthRange);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Initial load of static config
  useEffect(() => {
    Promise.all([
      apiFetch('/hr/councilor-profiles'),
      apiFetch('/hr/councilor-levels'),
      apiFetch('/counselors')
    ]).then(([cpRes, clRes, cRes]) => {
      setCLevels(clRes.items || []);
      const profiles = cpRes.items || [];
      setAllCProfiles(profiles);
      setCProfile(profiles.find(p => p.user_id === targetUserId) || null);
      setCounselorsList(cRes.items || []);
    }).catch(console.error);
  }, [targetUserId]);

  // Load dynamic data sensitive to date range
  useEffect(() => {
    const url = targetUserId
      ? `/leads?scope=mine&user_id=${targetUserId}&limit=2000`
      : '/leads?scope=mine&limit=2000';
    apiFetch(url).then((data) => setItems(data.items || [])).catch(() => setItems([]));

    const from = dateRange.from;
    const to = dateRange.to;
    // We also pass month/year fallback for attendance which wasn't updated
    const targetDate = new Date(to);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    Promise.all([
      apiFetch(`/hr/councilors/sales-report?from=${from}&to=${to}&month=${month}&year=${year}`),
      apiFetch(`/hr/attendance/report?month=${month}&year=${year}`)
    ]).then(([srRes, attRes]) => {
      setSalesMap(srRes.report || {});
      setWorkingDays(attRes.workingDays || 26);
      setAttendanceData((attRes.items || []).find(a => a.user_id === targetUserId)?.report || null);
    }).catch(console.error);
  }, [targetUserId, dateRange]);


  // Client-side date filtering
  const filteredItems = useMemo(() => {
    return items.filter(lead => {
      if (!lead.created_at) return false;
      const dt = lead.created_at.slice(0, 10);
      return (!dateRange.from || dt >= dateRange.from) && (!dateRange.to || dt <= dateRange.to);
    });
  }, [items, dateRange]);

  const levelMetrics = useMemo(() => {
    const defaultLvl = cLevels.length > 0 ? [...cLevels].sort((a, b) => a.level_name.localeCompare(b.level_name))[0] : null;
    const lvl = cProfile?.councilor_levels || defaultLvl;
    const targetAmt = lvl ? Number(lvl.target_amount) : 0;
    const achieved = salesMap[targetUserId] || 0;
    return { lvl, achieved, targetAmt, progress: targetAmt > 0 ? Math.min(100, Math.round((achieved / targetAmt) * 100)) : 0 };
  }, [cLevels, cProfile, salesMap, targetUserId]);

  const leaderboard = useMemo(() => {
    if (!counselorsList.length || !cLevels.length) return [];
    const defaultLvl = [...cLevels].sort((a, b) => a.level_name.localeCompare(b.level_name))[0];
    const mapped = counselorsList.map(c => {
      const profile = allCProfiles.find(p => p.user_id === c.id);
      const lvl = profile?.councilor_levels || defaultLvl;
      const targetAmt = lvl ? Number(lvl.target_amount) : 0;
      const achieved = salesMap[c.id] || 0;
      const progress = targetAmt > 0 ? Math.min(100, Math.round((achieved / targetAmt) * 100)) : 0;
      return { id: c.id, name: c.full_name?.split(' ')[0] || c.email?.split('@')[0] || 'Unknown', achieved, targetAmt, progress, levelName: lvl?.level_name || 'N/A' };
    });
    return mapped.sort((a, b) => b.progress !== a.progress ? b.progress - a.progress : b.achieved - a.achieved);
  }, [counselorsList, allCProfiles, cLevels, salesMap]);

  const metrics = useMemo(() => {
    const total = filteredItems.length;
    const activeArr = filteredItems.filter(l => l.status !== 'dropped' && l.status !== 'joined');
    const active = activeArr.length;
    const newLeads = filteredItems.filter(l => l.status === 'new').length;
    const contacted = filteredItems.filter(l => l.status === 'contacted').length;
    const demoScheduled = filteredItems.filter(l => l.status === 'demo_scheduled').length;
    const demoDone = filteredItems.filter(l => l.status === 'demo_done').length;
    const paymentPending = filteredItems.filter(l => l.status === 'payment_pending').length;
    const paymentVerification = filteredItems.filter(l => l.status === 'payment_verification').length;
    const joined = filteredItems.filter(l => l.status === 'joined').length;
    const dropped = filteredItems.filter(l => l.status === 'dropped').length;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayLeads = filteredItems.filter(l => {
      if (!l.created_at) return false;
      return new Date(l.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
    }).length;
    const conversionRate = total > 0 ? Math.round((joined / total) * 100) : 0;
    return { total, active, newLeads, contacted, demoScheduled, demoDone, paymentPending, paymentVerification, joined, dropped, todayLeads, conversionRate };
  }, [filteredItems]);

  const recentLeads = useMemo(() => {
    return [...filteredItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  }, [filteredItems]);

  const trendData = useMemo(() => {
    const days = [];
    if (!dateRange.from && !dateRange.to) {
      // If "All" is selected, just show the last 14 days of data to keep chart readable
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        days.push(toLocalISO(d));
      }
    } else {
      const start = new Date(dateRange.from + 'T00:00:00');
      const end = new Date(dateRange.to + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(toLocalISO(d));
      }
    }
    
    const displayDays = days.length > 31 ? days.slice(-31) : days;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const sessionsPerDay = displayDays.map(date => ({
      date,
      label: displayDays.length <= 14
        ? dayNames[new Date(date + 'T00:00:00').getDay()]
        : `${new Date(date + 'T00:00:00').getDate()}/${new Date(date + 'T00:00:00').getMonth() + 1}`,
      count: filteredItems.filter(l => l.created_at?.slice(0, 10) === date).length
    }));

    const maxVal = Math.max(...sessionsPerDay.map(d => d.count), 1);
    const len = sessionsPerDay.length;
    const w = 1000;
    const h = 200;
    const paddingX = len > 1 ? 0 : 500;
    
    const points = sessionsPerDay.map((d, i) => {
      const x = len > 1 ? (i / (len - 1)) * w : paddingX;
      const y = h - (d.count / maxVal) * (h * 0.8) - 10;
      return { x, y, count: d.count, label: d.label };
    });

    const path = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const area = points.length ? `${path} L ${points[points.length-1].x} ${h} L ${points[0].x} ${h} Z` : '';
    
    return { sessionsPerDay, lineChartData: { path, points, area } };
  }, [filteredItems, dateRange]);

  return (
    <section className="panel dashboard-charts">
      <style dangerouslySetInnerHTML={{ __html: CHART_STYLES }} />
      <DashboardDateFilter onChange={setDateRange} />

      {/* Target & Performance Banner */}
      <article className="card counselor-target-banner" style={{ padding: '24px', background: 'linear-gradient(to right, #173b73, #1f4b8f)', color: 'white', border: 'none' }}>
        <div className="cdb-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div className="cdb-main" style={{ flex: '1 1 200px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: 'rgba(255,255,255,0.9)' }}>
              Target & Performance - {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
              {levelMetrics.lvl && <span style={{ marginLeft: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px' }}>{levelMetrics.lvl.level_name}</span>}
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <h2 className="cdb-amount" style={{ margin: 0, fontSize: '32px' }}>₹{levelMetrics.achieved.toLocaleString()}</h2>
              <p className="cdb-target-label" style={{ margin: '0 0 6px 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>/ ₹{levelMetrics.targetAmt.toLocaleString()} Target</p>
            </div>
            <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${levelMetrics.progress}%`, background: '#10b981', transition: 'width 0.5s ease-in-out' }}></div>
            </div>
          </div>
          <div className="cdb-details" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div className="cdb-detail-box" style={{ background: 'rgba(255,255,255,0.1)', padding: '16px 24px', borderRadius: '12px', textAlign: 'center', minWidth: '150px' }}>
              <p className="cdb-detail-label" style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>Achievement</p>
              <p className="cdb-detail-value" style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{levelMetrics.progress}%</p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid-four counselor-stats-grid">
        <StatCard label="Lead Pipeline" value={metrics.total} />
        <StatCard label="Active Pipeline" value={metrics.active} />
        <StatCard label="Today's Leads" value={metrics.todayLeads} tone="info" />
        <StatCard label="Conversion Rate" value={`${metrics.conversionRate}%`} tone="success" />
      </div>

      <div className="flex-row-desktop" style={{ marginBottom: '20px' }}>
        <article className="card flex-2">
          <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>Lead Inflow Trend</h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>Daily acquisition rate</p>
          <div className="chart-container">
            {hoveredPoint && (
              <div 
                className="chart-val-tooltip-floating"
                style={{ 
                  left: `${(hoveredPoint.x / 1000) * 100}%`, 
                  top: `${(hoveredPoint.y / 200) * 100}%` 
                }}
              >
                <span className="chart-tooltip-date">{hoveredPoint.label}</span>
                <span className="chart-tooltip-val">{hoveredPoint.count} Leads</span>
              </div>
            )}
            <svg viewBox="0 0 1000 200" className="line-chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cHeadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4338ca" />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="40" x2="1000" y2="40" className="chart-grid-line" />
              <line x1="0" y1="80" x2="1000" y2="80" className="chart-grid-line" />
              <line x1="0" y1="120" x2="1000" y2="120" className="chart-grid-line" />
              <line x1="0" y1="160" x2="1000" y2="160" className="chart-grid-line" />
              
              <path d={trendData.lineChartData.area} className="chart-area" />
              <path d={trendData.lineChartData.path} className="chart-line" />
              
              {trendData.lineChartData.points.map((p, i) => (
                <circle 
                  key={i} 
                  cx={p.x} cy={p.y} r="4" 
                  className="chart-point"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
              <line x1="0" y1="198" x2="1000" y2="198" className="chart-axis-x" />
            </svg>
            {trendData.lineChartData.points.filter((_, i) => {
              const len = trendData.sessionsPerDay.length;
              if (len <= 15) return true;
              return i % Math.ceil(len / 10) === 0;
            }).map((p, i) => (
              <span key={i} className="chart-label-x" style={{ left: `${(p.x / 1000) * 100}%` }}>
                {p.label}
              </span>
            ))}
          </div>
        </article>

        <article className="card flex-1" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>Pipeline Breakdown</h3>
          {[
            { label: 'New', count: metrics.newLeads, color: '#6366f1' },
            { label: 'Contacted', count: metrics.contacted, color: '#8b5cf6' },
            { label: 'Demo Scheduled', count: metrics.demoScheduled, color: '#f59e0b' },
            { label: 'Demo Done', count: metrics.demoDone, color: '#3b82f6' },
            { label: 'Payment Pending', count: metrics.paymentPending, color: '#ec4899' },
            { label: 'Payment Verification', count: metrics.paymentVerification, color: '#f97316' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                <span style={{ fontSize: '13px' }}>{item.label}</span>
              </div>
              <strong style={{ fontSize: '14px' }}>{item.count}</strong>
            </div>
          ))}
        </article>
      </div>

      <div className="flex-row-desktop">
        <article className="card flex-1" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>Outcomes</h3>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#dcfce7', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#15803d' }}>{metrics.joined}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#15803d' }}>Joined</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#fee2e2', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{metrics.dropped}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }}>Dropped</p>
            </div>
          </div>
        </article>

        <article className="card flex-1" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Recent Leads</h3>
          {recentLeads.length ? recentLeads.map(lead => (
            <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
              <span style={{ fontWeight: 500 }}>{lead.student_name}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                background: lead.status === 'new' ? '#e0e7ff' : lead.status === 'joined' ? '#dcfce7' : '#f3f4f6',
                color: lead.status === 'new' ? '#4338ca' : lead.status === 'joined' ? '#15803d' : '#6b7280'
              }}>
                {lead.status.replace('_', ' ')}
              </span>
            </div>
          )) : <p className="text-muted" style={{ fontSize: '13px' }}>No leads yet</p>}
        </article>

        {/* Target Leaderboard */}
        <article className="card flex-1" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Target Leaderboard</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
            {leaderboard.length ? leaderboard.map((l, index) => (
              <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%',
                      background: index === 0 ? '#fef08a' : index === 1 ? '#e2e8f0' : index === 2 ? '#fed7aa' : '#f3f4f6',
                      color: index === 0 ? '#ca8a04' : index === 1 ? '#64748b' : index === 2 ? '#c2410c' : '#9ca3af',
                      fontSize: '11px', fontWeight: 'bold'
                    }}>{index + 1}</span>
                    <span style={{ fontSize: '13px', fontWeight: l.id === targetUserId ? '600' : '500', color: l.id === targetUserId ? '#4f46e5' : 'inherit' }}>
                      {l.name} {l.id === targetUserId && '(You)'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{l.achieved.toLocaleString()} <span style={{ color: l.progress >= 100 ? '#10b981' : '#6366f1' }}>({l.progress}%)</span></span>
                </div>
                <div style={{ background: '#f3f4f6', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${l.progress}%`, background: l.progress >= 100 ? '#10b981' : '#6366f1' }}></div>
                </div>
              </div>
            )) : <p className="text-muted" style={{ fontSize: '13px' }}>Loading board...</p>}
          </div>
        </article>

      </div>
    </section>
  );
}


/* ═══════ Simple Bar Chart ═══════ */
function SimpleBarChart({ data, xKey, yKeys, colors }) {
  const maxVal = Math.max(...data.map(d => yKeys.reduce((sum, k) => sum + (d[k] || 0), 0))) || 1;
  const chartH = 200;

  return (
    <div style={{ paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${chartH}px` }}>
        {data.map((item, i) => {
          const total = yKeys.reduce((sum, k) => sum + (item[k] || 0), 0);
          const barH = Math.max(Math.round((total / maxVal) * chartH), 4);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%', minWidth: 0 }}>
              <div style={{ width: '100%', maxWidth: '44px', height: `${barH}px`, display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden', transition: 'height 0.3s ease' }}>
                {yKeys.map((key, idx) => {
                  const val = item[key] || 0;
                  if (!total) return null;
                  return <div key={key} style={{ flex: `${val} 0 0`, background: colors[idx], width: '100%', minHeight: val ? '2px' : 0 }} title={`${key}: ${val}`} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        {data.map((item, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <span style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{item[xKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Daily Trend Line Chart (SVG) ═══════ */
function DailyTrendChart({ data, lineKeys, colors }) {
  if (!data.length || !lineKeys.length) return <p className="text-muted" style={{ fontSize: '13px', textAlign: 'center', padding: '16px' }}>No trend data available</p>;

  const W = 800, H = 240;
  const pad = { t: 16, r: 16, b: 44, l: 36 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const maxVal = Math.max(...data.flatMap(d => lineKeys.map(k => d[k] || 0)), 1);

  const getX = (i) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * cW : cW / 2);
  const getY = (v) => pad.t + cH * (1 - v / maxVal);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = getY(maxVal * p);
          return (
            <g key={p}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{Math.round(maxVal * p)}</text>
            </g>
          );
        })}
        {/* Lines */}
        {lineKeys.map((key, idx) => {
          const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(d[key] || 0)}`).join(' ');
          return (
            <g key={key}>
              <path d={pathD} fill="none" stroke={colors[idx % colors.length]} strokeWidth="2" strokeLinejoin="round" />
              {data.map((d, i) => <circle key={i} cx={getX(i)} cy={getY(d[key] || 0)} r="3" fill={colors[idx % colors.length]}><title>{d.date}: {d[key] || 0}</title></circle>)}
            </g>
          );
        })}
        {/* X labels */}
        {data.map((d, i) => {
          const show = data.length <= 15 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
          if (!show) return null;
          const dt = new Date(d.date + 'T00:00:00');
          const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return <text key={i} x={getX(i)} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill="#6b7280">{label}</text>;
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
        {lineKeys.map((key, idx) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <div style={{ width: '14px', height: '3px', background: colors[idx % colors.length], borderRadius: '2px' }} />
            <span style={{ color: '#374151' }}>{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Counselor Head Dashboard ═══════ */
export function CounselorHeadDashboardPage({ targetUserId }) {
  const [stats, setStats] = useState(null);
  const [filteredStats, setFilteredStats] = useState(null);
  const [counselors, setCounselors] = useState([]);
  const [cLevels, setCLevels] = useState([]);
  const [allCProfiles, setAllCProfiles] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [dateRange, setDateRange] = useState(getThisMonthRange);
  const [leadTypes, setLeadTypes] = useState([]);
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [droppedLeadType, setDroppedLeadType] = useState('all');
  const [droppedStats, setDroppedStats] = useState(null);
  const [allLeads, setAllLeads] = useState([]);

  // Static data — fetch once
  useEffect(() => {
    Promise.all([
      apiFetch('/counselors'),
      apiFetch('/hr/councilor-profiles'),
      apiFetch('/hr/councilor-levels'),
      apiFetch('/leads/types'),
      apiFetch('/leads?scope=all&limit=5000')
    ]).then(([counselorsData, cpRes, clRes, typesRes, leadsRes]) => {
      setCounselors(counselorsData.items || []);
      setCLevels(clRes.items || []);
      setAllCProfiles(cpRes.items || []);
      setLeadTypes(typesRes.types || []);
      setAllLeads(leadsRes.items || []);
    }).catch(console.error);
  }, []);

  // Stats — refetch on date or lead_type change
  useEffect(() => {
    const p = new URLSearchParams();
    if (dateRange.from) p.set('from', dateRange.from);
    if (dateRange.to) p.set('to', dateRange.to);
    if (targetUserId) p.set('user_id', targetUserId);
    const base = `/counselors/stats?${p.toString()}`;

    const fp = new URLSearchParams(p);
    if (leadTypeFilter !== 'all') fp.set('lead_type', leadTypeFilter);
    const filtered = `/counselors/stats?${fp.toString()}`;

    const toDate = dateRange.to ? new Date(dateRange.to) : new Date();
    const srPath = `/hr/councilors/sales-report?from=${dateRange.from || ''}&to=${dateRange.to || ''}&month=${toDate.getMonth() + 1}&year=${toDate.getFullYear()}`;

    Promise.all([
      apiFetch(base),
      leadTypeFilter !== 'all' ? apiFetch(filtered) : null,
      apiFetch(srPath)
    ]).then(([mainData, filteredData, srRes]) => {
      setStats(mainData.stats);
      setFilteredStats(filteredData ? filteredData.stats : mainData.stats);
      if (srRes) setSalesMap(srRes.report || {});
    }).catch(console.error);
  }, [targetUserId, dateRange, leadTypeFilter]);

  // Dropped stats — independent fetch with its own lead_type filter
  useEffect(() => {
    const p = new URLSearchParams();
    if (dateRange.from) p.set('from', dateRange.from);
    if (dateRange.to) p.set('to', dateRange.to);
    if (targetUserId) p.set('user_id', targetUserId);
    if (droppedLeadType !== 'all') p.set('lead_type', droppedLeadType);

    apiFetch(`/counselors/stats?${p.toString()}`)
      .then(data => setDroppedStats(data.stats))
      .catch(console.error);
  }, [targetUserId, dateRange, droppedLeadType]);

  // Daily lead trend — group leads by day + lead_type
  const dailyTrend = useMemo(() => {
    let filtered = allLeads;
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(l => {
        if (!l.created_at) return false;
        const dt = l.created_at.slice(0, 10);
        return (!dateRange.from || dt >= dateRange.from) && (!dateRange.to || dt <= dateRange.to);
      });
    }
    const types = new Set();
    const dateMap = {};
    filtered.forEach(l => {
      const day = l.created_at?.slice(0, 10);
      const type = l.lead_type || 'Unspecified';
      if (!day) return;
      types.add(type);
      if (!dateMap[day]) dateMap[day] = {};
      dateMap[day][type] = (dateMap[day][type] || 0) + 1;
    });
    const sortedDates = Object.keys(dateMap).sort();
    const typeArr = Array.from(types).sort();
    const data = sortedDates.map(date => {
      const entry = { date };
      typeArr.forEach(t => { entry[t] = dateMap[date][t] || 0; });
      return entry;
    });
    return { data, types: typeArr };
  }, [allLeads, dateRange]);

  const chartData = useMemo(() => {
    if (!stats || !counselors.length) return [];
    return counselors.map(c => {
      const s = stats[c.id] || { total: 0, active: 0, joined: 0, dropped: 0 };
      return {
        name: c.full_name?.split(' ')[0] || c.email.split('@')[0],
        Active: s.active,
        Joined: s.joined,
        Dropped: s.dropped
      };
    });
  }, [stats, counselors]);

  const totals = useMemo(() => {
    if (!stats) return { total: 0, joined: 0, dropped: 0, active: 0 };
    return Object.values(stats).reduce((acc, curr) => ({
      total: acc.total + curr.total,
      joined: acc.joined + curr.joined,
      dropped: acc.dropped + curr.dropped,
      active: acc.active + (curr.active || 0)
    }), { total: 0, joined: 0, dropped: 0, active: 0 });
  }, [stats]);

  // Leaderboard data from filteredStats (affected by lead_type filter)
  const leadsLeaderboard = useMemo(() => {
    if (!counselors.length) return [];
    const source = filteredStats || stats || {};
    return counselors.map(c => {
      const s = source[c.id] || {};
      return {
        id: c.id,
        name: c.full_name?.split(' ')[0] || c.email?.split('@')[0] || '?',
        fullName: c.full_name || c.email,
        new: s.new || 0,
        contacted: s.contacted || 0,
        demo_scheduled: s.demo_scheduled || 0,
        demo_done: s.demo_done || 0,
        payment_pending: s.payment_pending || 0,
        payment_verification: s.payment_verification || 0,
        joined: s.joined || 0,
        dropped: s.dropped || 0,
        total: s.total || 0,
        dropReasons: s.dropReasons || {}
      };
    }).sort((a, b) => b.total - a.total);
  }, [counselors, filteredStats, stats]);

  // Aggregate drop reasons from droppedStats (independent filter)
  const droppedLeaderboard = useMemo(() => {
    if (!counselors.length) return [];
    const source = droppedStats || stats || {};
    return counselors.map(c => {
      const s = source[c.id] || {};
      return {
        id: c.id,
        name: c.full_name?.split(' ')[0] || c.email?.split('@')[0] || '?',
        dropped: s.dropped || 0,
        dropReasons: s.dropReasons || {}
      };
    }).filter(c => c.dropped > 0).sort((a, b) => b.dropped - a.dropped);
  }, [counselors, droppedStats, stats]);

  const dropReasonsAgg = useMemo(() => {
    const source = droppedStats || stats || {};
    const reasons = {};
    Object.values(source).forEach(s => {
      Object.entries(s.dropReasons || {}).forEach(([reason, count]) => {
        reasons[reason] = (reasons[reason] || 0) + count;
      });
    });
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  }, [droppedStats, stats]);

  const totalDropped = useMemo(() => dropReasonsAgg.reduce((s, [, c]) => s + c, 0), [dropReasonsAgg]);

  // Target leaderboard (NOT affected by lead_type, uses salesMap)
  const targetLeaderboard = useMemo(() => {
    if (!counselors.length || !cLevels.length) return [];
    const defaultLvl = [...cLevels].sort((a, b) => a.level_name.localeCompare(b.level_name))[0];
    const mapped = counselors.map(c => {
      const profile = allCProfiles.find(p => p.user_id === c.id);
      const lvl = profile?.councilor_levels || defaultLvl;
      const targetAmt = lvl ? Number(lvl.target_amount) : 0;
      const achieved = salesMap[c.id] || 0;
      const progress = targetAmt > 0 ? Math.min(100, Math.round((achieved / targetAmt) * 100)) : 0;
      return { id: c.id, name: c.full_name || c.email?.split('@')[0] || 'Unknown', achieved, targetAmt, progress, levelName: lvl?.level_name || 'N/A' };
    });
    return mapped.sort((a, b) => b.progress !== a.progress ? b.progress - a.progress : b.achieved - a.achieved);
  }, [counselors, allCProfiles, cLevels, salesMap]);

  const statusColors = {
    new: '#6366f1', contacted: '#8b5cf6', demo_scheduled: '#f59e0b',
    demo_done: '#3b82f6', payment_pending: '#ec4899', payment_verification: '#f97316',
    joined: '#15803d', dropped: '#dc2626'
  };

  const trendColors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48', '#a855f7'];

  return (
    <section className="panel">
      <DashboardDateFilter onChange={setDateRange} />

      {/* Stat Cards */}
      <div className="grid-four counselor-head-stats-grid">
        <StatCard label="Total Leads" value={totals.total} />
        <StatCard label="Active" value={totals.active} tone="info" />
        <StatCard label="Converted" value={totals.joined} tone="success" />
        <StatCard label="Dropped" value={totals.dropped} tone="danger" />
      </div>

      {/* Team Performance Chart */}
      <div className="grid-two">
        <article className="card">
          <h3>Team Performance</h3>
          <p className="text-sm text-dim">Active (Blue) vs Joined (Green) vs Dropped (Red)</p>
          <SimpleBarChart
            data={chartData}
            xKey="name"
            yKeys={['Dropped', 'Joined', 'Active']}
            colors={['#ef4444', '#10b981', '#3b82f6']}
          />
        </article>

        {/* Target Leaderboard */}
        <article className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Target Leaderboard</h3>
          {targetLeaderboard.length ? targetLeaderboard.map((l, index) => (
            <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%',
                    background: index === 0 ? '#fef08a' : index === 1 ? '#e2e8f0' : index === 2 ? '#fed7aa' : '#f3f4f6',
                    color: index === 0 ? '#ca8a04' : index === 1 ? '#64748b' : index === 2 ? '#c2410c' : '#9ca3af',
                    fontSize: '11px', fontWeight: 'bold'
                  }}>{index + 1}</span>
                  <span style={{ fontSize: '14px', fontWeight: l.id === targetUserId ? '600' : '500', color: l.id === targetUserId ? '#4f46e5' : 'inherit' }}>
                    {l.name} {l.id === targetUserId && '(You)'}
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>₹{l.achieved.toLocaleString()} / ₹{l.targetAmt.toLocaleString()} <span style={{ color: l.progress >= 100 ? '#10b981' : '#6366f1' }}>({l.progress}%)</span></span>
              </div>
              <div style={{ background: '#f3f4f6', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${l.progress}%`, background: l.progress >= 100 ? '#10b981' : '#6366f1' }}></div>
              </div>
            </div>
          )) : <p className="text-muted" style={{ fontSize: '13px' }}>Loading board...</p>}
        </article>
      </div>

      {/* ═══════ Daily Lead Trend ═══════ */}
      <div style={{ marginTop: '16px' }}>
        <article className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>📈 Daily Lead Trend</h3>
          <p className="text-muted" style={{ fontSize: '12px', margin: '0 0 12px' }}>Leads created per day by lead type</p>
          <DailyTrendChart data={dailyTrend.data} lineKeys={dailyTrend.types} colors={trendColors} />
        </article>
      </div>

      {/* ═══════ Lead Stats Leaderboard (filtered by lead type) ═══════ */}
      <div style={{ marginTop: '16px' }}>
        <article className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>📊 Lead Stats Leaderboard</h3>
            <LeadTypeSelect value={leadTypeFilter} onChange={setLeadTypeFilter} leadTypes={leadTypes} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '12px', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Counselor</th>
                  <th style={{ color: statusColors.new }}>New</th>
                  <th style={{ color: statusColors.contacted }}>Cntd</th>
                  <th style={{ color: statusColors.demo_scheduled }}>Demo S.</th>
                  <th style={{ color: statusColors.demo_done }}>Demo D.</th>
                  <th style={{ color: statusColors.payment_pending }}>Pmt P.</th>
                  <th style={{ color: statusColors.payment_verification }}>Pmt V.</th>
                  <th style={{ color: statusColors.joined, fontWeight: 700 }}>Joined</th>
                  <th style={{ color: statusColors.dropped, fontWeight: 700 }}>Dropped</th>
                  <th style={{ fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {leadsLeaderboard.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                    <td>{c.new || '–'}</td>
                    <td>{c.contacted || '–'}</td>
                    <td>{c.demo_scheduled || '–'}</td>
                    <td>{c.demo_done || '–'}</td>
                    <td>{c.payment_pending || '–'}</td>
                    <td>{c.payment_verification || '–'}</td>
                    <td style={{ color: '#15803d', fontWeight: 700 }}>{c.joined || '–'}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{c.dropped || '–'}</td>
                    <td style={{ fontWeight: 800, fontSize: '13px' }}>{c.total}</td>
                  </tr>
                ))}
                {!leadsLeaderboard.length && <tr><td colSpan="10" style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {/* ═══════ Dropped Leads Analysis ═══════ */}
      <div style={{ marginTop: '16px' }}>
        <article className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>🚫 Dropped Leads Analysis <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginLeft: '8px' }}>({totalDropped})</span></h3>
            <LeadTypeSelect value={droppedLeadType} onChange={setDroppedLeadType} leadTypes={leadTypes} />
          </div>

          {dropReasonsAgg.length ? (
            <div className="grid-two" style={{ gap: '16px' }}>
              {/* Horizontal bar chart of drop reasons */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drop Reasons</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dropReasonsAgg.map(([reason, count]) => {
                    const maxCount = dropReasonsAgg[0][1] || 1;
                    return (
                      <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ flex: '0 0 120px', fontSize: '12px', fontWeight: 500, textAlign: 'right', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={reason}>{reason}</span>
                        <div style={{ flex: 1, background: '#fef2f2', borderRadius: '4px', height: '24px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            width: `${(count / maxCount) * 100}%`, height: '100%',
                            background: 'linear-gradient(90deg, #fca5a5, #ef4444)', borderRadius: '4px',
                            transition: 'width 0.4s ease-in-out', minWidth: '2px'
                          }} />
                          <span style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            fontSize: '11px', fontWeight: 700, color: '#991b1b'
                          }}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-counselor dropped breakdown */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Per Counselor Breakdown</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '12px', width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#fef2f2' }}>
                        <th>Counselor</th>
                        <th>Dropped</th>
                        <th>Top Reason</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {droppedLeaderboard.map(c => {
                        const reasons = Object.entries(c.dropReasons || {}).sort((a, b) => b[1] - a[1]);
                        const topReason = reasons[0];
                        return (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ color: '#dc2626', fontWeight: 700 }}>{c.dropped}</td>
                            <td style={{ fontSize: '11px', color: '#6b7280' }}>{topReason ? topReason[0] : '—'}</td>
                            <td style={{ fontWeight: 600 }}>{topReason ? topReason[1] : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '13px', textAlign: 'center', padding: '20px' }}>No dropped leads with reasons in this period.</p>
          )}
        </article>
      </div>
    </section>
  );
}
