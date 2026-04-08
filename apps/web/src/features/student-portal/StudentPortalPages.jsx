import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api.js';
import { ReceiptModal, getBranding } from '../finance/InvoiceTemplate.jsx';

const formatTime = (timeStr) => {
  if (!timeStr) return '—';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

  // Handle ISO strings (e.g. 2026-04-08T13:00:00+05:30)
  if (timeStr.includes('T')) {
    try {
      return new Date(timeStr).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();
    } catch (e) {
      console.warn("Invalid date string encountered:", timeStr);
    }
  }

  // Handle simple HH:MM[:SS] strings (e.g. 13:00)
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

const groupTeachers = (list = []) => {
  const groups = {};
  list.forEach(a => {
    if (!groups[a.teacher_id]) {
      groups[a.teacher_id] = { ...a, subjects: [] };
    }
    if (!groups[a.teacher_id].subjects.includes(a.subject)) {
      groups[a.teacher_id].subjects.push(a.subject);
    }
  });
  return Object.values(groups);
};

// ─────────────────────────────────────────────────
// Shared Styles
// ─────────────────────────────────────────────────
const STUDENT_STYLES = `
  .sp-page { padding:16px; max-width:600px; margin:0 auto; font-family:'Inter','Segoe UI',system-ui,sans-serif; }
  .sp-card { background:#fff; border-radius:16px; padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); border:1px solid #f1f5f9; }
  .sp-card-header { font-size:15px; font-weight:700; color:#0f172a; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
  .sp-empty { text-align:center; color:#94a3b8; font-size:14px; padding:24px 0; }
  .sp-badge { display:inline-flex; align-items:center; padding:4px 8px; border-radius:20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; flex-shrink:0; white-space:nowrap; height:fit-content; }
  .sp-badge-green { background:#dcfce7; color:#166534; }
  .sp-badge-yellow { background:#fef9c3; color:#854d0e; }
  .sp-badge-red { background:#fee2e2; color:#991b1b; }
  .sp-badge-blue { background:#dbeafe; color:#1e40af; }
  .sp-badge-gray { background:#f1f5f9; color:#475569; }
  .sp-badge-purple { background:#ede9fe; color:#5b21b6; }
  .sp-badge-orange { background:#ffedd5; color:#9a3412; }

  .sp-welcome { background:linear-gradient(135deg,#1e3a5f,#1f4b8f); border-radius:20px; padding:24px; color:#fff; margin-bottom:16px; position:relative; overflow:hidden; }
  .sp-welcome::before { content:''; position:absolute; top:-40px; right:-40px; width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,0.08); }
  .sp-welcome h2 { margin:0 0 4px; font-size:20px; font-weight:700; }
  .sp-welcome p { margin:0; font-size:13px; opacity:0.8; }
  .sp-welcome .sp-code { display:inline-block; margin-top:8px; background:rgba(255,255,255,0.15); padding:4px 12px; border-radius:8px; font-size:12px; font-weight:600; }

  .sp-hours-ring { display:flex; align-items:center; gap:20px; }
  .sp-ring-wrap { position:relative; width:90px; height:90px; flex-shrink:0; }
  .sp-ring-svg { width:90px; height:90px; transform:rotate(-90deg); }
  .sp-ring-bg { fill:none; stroke:#e2e8f0; stroke-width:8; }
  .sp-ring-fg { fill:none; stroke:#22c55e; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 0.8s ease; }
  .sp-ring-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:18px; font-weight:800; color:#0f172a; }
  .sp-ring-label { font-size:10px; color:#64748b; font-weight:500; }

  .sp-session-item { display:flex; align-items:flex-start; gap:12px; padding:14px; border-radius:14px; background:#fff; border:1px solid #f1f5f9; margin-bottom:10px; transition:all 0.2s; cursor:pointer; }
  .sp-session-item:hover { background:#f8fafc; transform:translateY(-1px); box-shadow:0 10px 15px -3px rgba(0,0,0,0.04); border-color:#e2e8f0; }
  .sp-session-time { font-size:13px; font-weight:800; color:#1f4b8f; width:72px; flex-shrink:0; display:flex; flex-direction:column; line-height:1.1; margin-top:2px; }
  .sp-session-time small { font-size:10px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-top:4px; letter-spacing:0.3px; }
  .sp-session-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; margin-right:4px; }
  .sp-session-subj { font-size:14px; font-weight:700; color:#111827; line-height:1.2; overflow:hidden; text-overflow:ellipsis; }
  .sp-session-teacher { font-size:11px; color:#64748b; display:flex; align-items:center; gap:6px; line-height:1.2; }

  .sp-quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sp-action-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 8px; border-radius:14px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; transition:all 0.2s; font-family:inherit; }
  .sp-action-btn:hover { background:#f8fafc; transform:translateY(-1px); box-shadow:0 4px 6px rgba(0,0,0,0.05); }
  .sp-action-icon { font-size:24px; display: flex; }
  .sp-action-label { font-size:11px; font-weight:700; color:#374151; }

  .sp-pay-item { padding:14px; border-radius:12px; background:#f8fafc; margin-bottom:10px; border-left:4px solid #e2e8f0; }
  .sp-pay-item.verified { border-left-color:#22c55e; }
  .sp-pay-item.pending { border-left-color:#eab308; }
  .sp-pay-item.rejected { border-left-color:#ef4444; }
  .sp-pay-row { display:flex; justify-content:space-between; align-items:center; }
  .sp-pay-amount { font-size:18px; font-weight:800; color:#0f172a; }
  .sp-pay-date { font-size:12px; color:#64748b; }
  .sp-pay-detail { font-size:12px; color:#64748b; margin-top:4px; }
  .sp-download-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 12px; border-radius:8px; background:#1f4b8f; color:#fff; border:none; font-size:11px; cursor:pointer; margin-top:8px; font-weight:600; font-family:inherit; }

  .sp-remark-timeline { position:relative; padding-left:24px; }
  .sp-remark-timeline::before { content:''; position:absolute; left:8px; top:0; bottom:0; width:2px; background:#e2e8f0; }
  .sp-remark-item { position:relative; margin-bottom:16px; padding:14px; background:#f8fafc; border-radius:12px; border:1px solid #f1f5f9; }
  .sp-remark-item::before { content:''; position:absolute; left:-20px; top:18px; width:10px; height:10px; border-radius:50%; border:2px solid #fff; }
  .sp-remark-item.type-general::before { background:#22c55e; }
  .sp-remark-item.type-exam::before { background:#3b82f6; }
  .sp-remark-item.type-attendance::before { background:#f59e0b; }
  .sp-remark-item.type-behaviour::before { background:#ef4444; }
  .sp-remark-item.type-parents_meeting::before { background:#8b5cf6; }
  .sp-remark-title { font-size:14px; font-weight:600; color:#0f172a; margin-bottom:4px; }
  .sp-remark-desc { font-size:13px; color:#475569; line-height:1.5; }
  .sp-remark-meta { font-size:11px; color:#94a3b8; margin-top:6px; display:flex; gap:12px; flex-wrap:wrap; }

  .sp-profile-field { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; }
  .sp-profile-field:last-child { border-bottom:none; }
  .sp-profile-key { font-size:13px; color:#64748b; }
  .sp-profile-val { font-size:13px; font-weight:600; color:#0f172a; text-align:right; }

  .sp-pin-form { display:flex; flex-direction:column; gap:10px; }
  .sp-pin-input { padding:12px 16px; border:2px solid #e2e8f0; border-radius:12px; font-size:16px; text-align:center; letter-spacing:6px; font-weight:700; outline:none; font-family:inherit; }
  .sp-pin-input:focus { border-color:#3b82f6; }
  .sp-pin-btn { padding:12px; border:none; border-radius:12px; background:#1f4b8f; color:#fff; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  .sp-pin-btn:disabled { opacity:0.5; }
  .sp-pin-success { color:#16a34a; font-size:13px; text-align:center; font-weight:500; }
  .sp-pin-error { color:#dc2626; font-size:13px; text-align:center; font-weight:500; }

  .sp-teacher-list-item { display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; background:#fff; border:1px solid #f1f5f9; margin-bottom:10px; transition:all 0.2s; cursor:pointer; }
  .sp-teacher-list-item:hover { background:#f8fafc; border-color:#e2e8f0; transform:translateY(-1px); }
  .sp-teacher-avatar { width:40px; height:40px; border-radius:50%; background:#f0f9ff; color:#1e40af; border:1px solid #e0f2fe; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; flex-shrink:0; }
  .sp-teacher-info { flex:1; }
  .sp-teacher-name { font-size:14px; font-weight:700; color:#111827; }
  .sp-teacher-subj { font-size:11px; color:#64748b; margin-top:2px; font-weight:500; }

  /* Materials Chat Styles */
  .spm-container { display:flex; flex-direction:row; height:70vh; min-height:400px; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb; }
  .spm-sidebar { width:260px; min-width:260px; border-right:1px solid #e5e7eb; background:#f9fafb; display:flex; flex-direction:column; overflow-y:auto; }
  .spm-main { flex:1; display:flex; flex-direction:column; background:#ece5dd; overflow:hidden; }
  .spm-history { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; -webkit-overflow-scrolling:touch; }
  .spm-mobile-back { display:none; background:none; border:none; font-size:20px; cursor:pointer; padding:0 10px 0 0; color:#374151; }

  @media (max-width:1023px) {
    .sp-page { padding:12px 8px; }
    .spm-container { flex-direction:column; height:calc(100dvh - 140px); border-radius:0; border:none; }
    .spm-sidebar { width:100%; min-width:100%; border-right:none; }
    .spm-main { display:none; }
    .spm-container.chat-open { position:fixed; top:0; left:0; right:0; bottom:0; height:100dvh; z-index:50; }
    .spm-container.chat-open .spm-sidebar { display:none; }
    .spm-container.chat-open .spm-main { display:flex; }
    .spm-container.chat-open .spm-mobile-back { display:inline-block; }
  }

  @media (min-width: 1024px) {
    .sp-page { max-width:1200px; padding:12px 20px; margin:0; }
    .sp-grid-2 { display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; }
    .sp-grid-3 { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
    .sp-grid-4 { display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; }
    .sp-welcome { padding:40px; border-radius:24px; }
    .sp-welcome h2 { font-size:28px; }
    .sp-welcome p { font-size:15px; }
    .sp-overview-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items: stretch; margin-bottom: 20px; }
    .sp-overview-grid > .sp-card { margin-bottom: 0; }
  }
`;

// ─────────────────────────────────────────────────
// Professional SVG Icons
// ─────────────────────────────────────────────────
const ICONS = {
  user: (color = '#1f4b8f') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  payments: (color = '#166534') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  materials: (color = '#854d0e') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  remarks: (color = '#1e40af') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  teachers: (color = '#166534') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  calendar: (color = '#1f4b8f') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  clock: (color = '#1f4b8f') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  lock: (color = '#1f4b8f') => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  user_small: (color = '#64748b') => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
};

// ─────────────────────────────────────────────────
// STUDENT DASHBOARD PAGE
// ─────────────────────────────────────────────────
export function StudentDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  useEffect(() => {
    apiFetch('/students/my-dashboard')
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="sp-page"><div className="sp-card"><p style={{ textAlign: 'center', color: '#94a3b8' }}>Loading...</p></div></div>;
  if (!data?.student) return <div className="sp-page"><div className="sp-card"><p className="sp-empty">Could not load dashboard.</p></div></div>;

  const s = data.student;
  const remaining = Number(s.remaining_hours || 0);
  const total = Number(s.total_hours || 1);
  const pct = Math.min(100, Math.round((remaining / total) * 100));
  const circumference = 2 * Math.PI * 37;
  const offset = circumference - (pct / 100) * circumference;

  const greetName = s.student_name ? s.student_name.split(' ')[0] : 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const groupedTeachers = groupTeachers(data.assignments);
  const visibleTeachers = showAllTeachers ? groupedTeachers : groupedTeachers.slice(0, 3);
  const visibleRecent = showAllRecent ? data.recentSessions : data.recentSessions.slice(0, 3);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STUDENT_STYLES }} />
      <div className="sp-page">
        {/* Welcome Banner */}
        <div className="sp-welcome">
          <h2>{greeting}, {greetName}! 👋</h2>
          <p>{s.class_level || ''} {s.board ? `• ${s.board}` : ''} {s.medium ? `• ${s.medium}` : ''}</p>
          <span className="sp-code">ID: {s.student_code || '—'}</span>
        </div>

        <div className="sp-overview-grid">
          {/* Hours Summary */}
          <div className="sp-card">
            <div className="sp-card-header">
              <span style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', display: 'flex' }}>{ICONS.clock()}</span>
              Hours Summary
            </div>
            <div className="sp-hours-ring">
              <div className="sp-ring-wrap">
                <svg className="sp-ring-svg" viewBox="0 0 90 90">
                  <circle className="sp-ring-bg" cx="45" cy="45" r="37" />
                  <circle className="sp-ring-fg" cx="45" cy="45" r="37"
                    style={{ strokeDasharray: circumference, strokeDashoffset: offset, stroke: pct > 30 ? '#22c55e' : pct > 10 ? '#eab308' : '#ef4444' }}
                  />
                </svg>
                <div className="sp-ring-text">{remaining}<span className="sp-ring-label">h</span></div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Remaining Hours</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>{remaining} of {total} hours left</div>
              </div>
            </div>
          </div>

          {/* Today's Classes */}
          <div className="sp-card">
            <div className="sp-card-header">
              <span style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', display: 'flex' }}>{ICONS.calendar()}</span>
              Today's Classes
            </div>
            {data.todaySessions.length === 0 ? (
              <p className="sp-empty">No classes scheduled for today</p>
            ) : (
              data.todaySessions.map(sess => (
                <div key={sess.id} className="sp-session-item">
                  <div className="sp-session-time">
                    {formatTime(sess.started_at)}
                    <small>Today</small>
                  </div>
                  <div className="sp-session-info">
                    <div className="sp-session-subj">{sess.subject || 'Class Session'}</div>
                    <div className="sp-session-teacher">
                      {ICONS.user_small()}
                      <span>{sess.teacher_name} • {sess.duration_hours}h</span>
                    </div>
                  </div>
                  <span className={`sp-badge ${sess.status === 'completed' ? 'sp-badge-green' : sess.status === 'scheduled' ? 'sp-badge-blue' : 'sp-badge-gray'}`} style={{ marginTop: '2px' }}>
                    {sess.status === 'completed' ? '✓ ' : ''}{sess.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="sp-card">
          <div className="sp-card-header">⚡ Quick Actions</div>
          <div className="sp-quick-actions sp-grid-4">
            <button className="sp-action-btn" onClick={() => onNavigate('/student/payments')}>
              <span className="sp-action-icon" style={{ background: '#dcfce7', padding: '8px', borderRadius: '14px' }}>{ICONS.payments('#166534')}</span>
              <span className="sp-action-label">Payments</span>
            </button>
            <button className="sp-action-btn" onClick={() => onNavigate('/student/materials')}>
              <span className="sp-action-icon" style={{ background: '#fef9c3', padding: '8px', borderRadius: '14px' }}>{ICONS.materials('#854d0e')}</span>
              <span className="sp-action-label">Materials</span>
            </button>
            <button className="sp-action-btn" onClick={() => onNavigate('/student/profile')}>
              <span className="sp-action-icon" style={{ background: '#ede9fe', padding: '8px', borderRadius: '14px' }}>{ICONS.user('#5b21b6')}</span>
              <span className="sp-action-label">Profile</span>
            </button>
            <button className="sp-action-btn" onClick={() => onNavigate('/student/profile')}>
              <span className="sp-action-icon" style={{ background: '#dbeafe', padding: '8px', borderRadius: '14px' }}>{ICONS.remarks('#1e40af')}</span>
              <span className="sp-action-label">Remarks</span>
            </button>
          </div>
        </div>

        {/* Assigned Teachers */}
        {data.assignments.length > 0 && (
          <div className="sp-card">
            <div className="sp-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#dcfce7', padding: '6px', borderRadius: '8px', display: 'flex' }}>{ICONS.teachers('#166534')}</span>
                My Teachers
              </div>
              {data.assignments.length > 3 && (
                <button onClick={() => onNavigate('/student/profile#teachers')} style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px', fontWeight: 600, color: '#1f4b8f', cursor: 'pointer' }}>
                  Show All ({data.assignments.length})
                </button>
              )}
            </div>
            <div className="sp-grid-2">
              {visibleTeachers.map((a, i) => (
                <div key={i} className="sp-teacher-list-item">
                  <div className="sp-teacher-avatar">{a.teacher_name.charAt(0).toUpperCase()}</div>
                  <div className="sp-teacher-info">
                    <div className="sp-teacher-name">{a.teacher_name}</div>
                    <div className="sp-teacher-subj">{a.subjects.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {data.recentSessions.length > 0 && (
          <div className="sp-card">
            <div className="sp-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', display: 'flex' }}>{ICONS.clock()}</span>
                Recent Sessions
              </div>
              {data.recentSessions.length > 3 && (
                <button onClick={() => onNavigate('/student/history#sessions')} style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px', fontWeight: 600, color: '#1f4b8f', cursor: 'pointer' }}>
                  View All History
                </button>
              )}
            </div>
            <div className="sp-grid-2">
              {visibleRecent.map(sess => (
                <div key={sess.id} className="sp-session-item">
                  <div className="sp-session-time">
                    {formatTime(sess.started_at)}
                    <small>{new Date(sess.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small>
                  </div>
                  <div className="sp-session-info">
                    <div className="sp-session-subj">{sess.subject || 'Class Session'}</div>
                    <div className="sp-session-teacher">
                      {ICONS.user_small()}
                      <span>{sess.teacher_name} • {sess.duration_hours}h</span>
                    </div>
                  </div>
                  <span className={`sp-badge ${sess.status === 'completed' ? 'sp-badge-green' : sess.status === 'cancelled' ? 'sp-badge-red' : 'sp-badge-gray'}`} style={{ marginTop: '2px' }}>
                    {sess.status === 'completed' ? '✓ ' : ''}{sess.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────
// STUDENT HISTORY PAGE
// ─────────────────────────────────────────────────
export function StudentHistoryPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' | 'sessions'
  const [payData, setPayData] = useState(null);
  const [sessionData, setSessionData] = useState([]);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiptPayment, setReceiptPayment] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/students/my-payments'),
      apiFetch('/students/my-dashboard'),
      apiFetch('/students/my-sessions')
    ]).then(([payRes, dashRes, sessRes]) => {
      setPayData(payRes);
      setStudentInfo(dashRes?.student);
      setSessionData(sessRes?.items || []);
      setLoading(false);

      // Deep link to tab via hash
      const hash = window.location.hash;
      if (hash === '#sessions') setActiveTab('sessions');
      else if (hash === '#payments') setActiveTab('payments');
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="sp-page"><div className="sp-card"><p style={{ textAlign: 'center', color: '#94a3b8' }}>Loading history...</p></div></div>;

  const payments = payData?.paymentRequests || [];
  const topups = payData?.topups || [];

  // Only show verified / approved payments to the student
  const allPayments = [
    ...payments
      .filter(p => p.status === 'verified' || p.status === 'approved')
      .map(p => ({ ...p, payType: 'Initial', date: p.effective_date || p.created_at })),
    ...topups
      .filter(t => t.status === 'verified' || t.status === 'approved')
      .map(t => ({ ...t, payType: 'Top-up', date: t.created_at }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const tabStyle = (tab) => ({
    flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '11px', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px',
    color: activeTab === tab ? '#1f4b8f' : '#94a3b8',
    borderBottom: activeTab === tab ? '2px solid #1f4b8f' : '2px solid transparent',
    transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STUDENT_STYLES }} />
      <div className="sp-page">
        <div className="sp-card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* History Page Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <button style={tabStyle('payments')} onClick={() => setActiveTab('payments')}>
              {ICONS.payments(activeTab === 'payments' ? '#1f4b8f' : '#94a3b8')} Payments
            </button>
            <button style={tabStyle('sessions')} onClick={() => setActiveTab('sessions')}>
              {ICONS.clock(activeTab === 'sessions' ? '#1f4b8f' : '#94a3b8')} Sessions
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {activeTab === 'payments' && (
              <>
                <div className="sp-card-header">💰 Verified Payments</div>
                {allPayments.length === 0 ? <p className="sp-empty">No verified payments found</p> : null}
                <div className="sp-grid-2">
                  {allPayments.map((p, i) => (
                    <div key={i} className="sp-pay-item verified">
                      <div className="sp-pay-row">
                        <div>
                          <div className="sp-pay-amount">₹{Number(p.amount || 0).toLocaleString('en-IN')}</div>
                          <div className="sp-pay-detail">
                            {p.payType} {p.hours ? `• ${p.hours}h` : p.hours_added ? `• ${p.hours_added}h` : ''}
                            {p.total_amount && Number(p.total_amount) > Number(p.amount) && (
                              <span> • Total: ₹{Number(p.total_amount).toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="sp-badge sp-badge-green">✓ Verified</span>
                          <div className="sp-pay-date">{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <button className="sp-download-btn" onClick={() => setReceiptPayment({ ...p, _type: p.payType === 'Top-up' ? 'topup' : 'payment' })}>
                        📄 View Receipt
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'sessions' && (
              <>
                <div className="sp-card-header">🎓 Full Class History</div>
                {sessionData.length === 0 ? (
                  <p className="sp-empty">No class sessions recorded yet</p>
                ) : (
                  sessionData.map(sess => (
                    <div key={sess.id} className="sp-session-item" style={{ padding: '16px', background: '#fff', border: '1px solid #f1f5f9', marginBottom: '12px', display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f4b8f' }}>{new Date(sess.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Started: {formatTime(sess.started_at)}</div>
                        </div>
                        <span className={`sp-badge ${sess.status === 'completed' ? 'sp-badge-green' : sess.status === 'cancelled' ? 'sp-badge-red' : 'sp-badge-blue'}`}>
                          {sess.status === 'completed' ? '✓ ' : ''}{sess.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{sess.subject || 'Academic session'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #f1f5f9' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          👤 {sess.teacher_name}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{sess.duration_hours} Hrs</div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Receipt / Invoice Modal */}
      {receiptPayment && (
        <StudentReceiptModal
          payment={receiptPayment}
          student={studentInfo}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────
// STUDENT RECEIPT MODAL (inline invoice)
// ─────────────────────────────────────────────────
function StudentReceiptModal({ payment, student, onClose }) {
  const company = getBranding();
  const isTopup = payment._type === 'topup';
  const studentName = student?.student_name || payment.leads?.student_name || payment.students?.student_name || '—';
  const phone = student?.contact_number || payment.leads?.contact_number || payment.students?.contact_number || '—';

  const docNumber = `RCP-${new Date().getFullYear()}-${(payment.id || '').slice(0, 6).toUpperCase()}`;
  const paidDate = payment.verified_at || payment.updated_at
    ? new Date(payment.verified_at || payment.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const description = isTopup
    ? `Top-Up Payment — ${payment.hours_added || '?'} hrs`
    : `Onboarding / Payment — ${payment.hours || '?'} hrs${payment.total_amount ? `, Package ₹${Number(payment.total_amount).toLocaleString('en-IN')}` : ''}`;

  const items = [{ description, hours: isTopup ? payment.hours_added : payment.hours, amount: Number(payment.amount || 0) }];
  const total = Number(payment.total_amount || payment.amount || 0);
  const paidAmount = Number(payment.amount || 0);

  function handlePrint() {
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`
      <!DOCTYPE html><html><head><title>${docNumber}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:40px;}
      .doc{max-width:680px;margin:auto;}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4338ca;padding-bottom:20px;margin-bottom:24px;}
      .cname{font-size:20px;font-weight:800;color:#4338ca;}.csub{font-size:11px;color:#6b7280;line-height:1.6;}
      .dtitle{font-size:24px;font-weight:900;letter-spacing:2px;color:#15803d;}.dnum{font-size:12px;color:#6b7280;margin-top:4px;}
      .stamp{display:inline-block;border:3px solid #15803d;color:#15803d;font-size:18px;font-weight:900;padding:4px 14px;border-radius:6px;transform:rotate(-8deg);letter-spacing:3px;margin-top:10px;}
      .party{background:#f9fafb;border-radius:8px;padding:14px 18px;margin-bottom:24px;}
      .plabel{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      .pname{font-size:16px;font-weight:700;}.pphone{font-size:12px;color:#4b5563;margin-top:2px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}thead th{background:#4338ca;color:#fff;padding:10px 14px;text-align:left;font-size:12px;}
      tbody td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;}
      .totals{display:flex;justify-content:flex-end;margin-bottom:24px;}.tbox{width:260px;}
      .trow{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f3f4f6;}
      .trow.main{font-size:15px;font-weight:800;color:#4338ca;border-top:2px solid #4338ca;border-bottom:none;padding-top:10px;}
      .footer{border-top:1px solid #e5e7eb;padding-top:14px;text-align:center;font-size:11px;color:#9ca3af;}
      </style></head><body><div class="doc">
      <div class="hdr">
        <div><div class="cname">${company.name}</div>${company.tagline ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${company.tagline}</div>` : ''}
        <div class="csub">${company.address ? `${company.address}<br>` : ''}${company.phone ? `📞 ${company.phone}<br>` : ''}${company.email ? `✉ ${company.email}` : ''}</div></div>
        <div style="text-align:right"><div class="dtitle">RECEIPT</div><div class="dnum">${docNumber}</div>
        <div style="font-size:12px;color:#6b7280;">Date: ${paidDate || new Date().toLocaleDateString('en-IN')}</div><div class="stamp">PAID ✓</div></div>
      </div>
      <div class="party"><div class="plabel">Bill To</div><div class="pname">${studentName}</div>${phone !== '—' ? `<div class="pphone">📞 ${phone}</div>` : ''}</div>
      <table><thead><tr><th>Description</th><th style="text-align:center">Hrs</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody><tr><td>${description}</td><td style="text-align:center">${items[0].hours || '—'}</td><td style="text-align:right;font-weight:600">₹${paidAmount.toLocaleString('en-IN')}</td></tr></tbody></table>
      <div class="totals"><div class="tbox">
        <div class="trow"><span style="color:#6b7280">Total Amount</span><span style="font-weight:600">₹${total.toLocaleString('en-IN')}</span></div>
        <div class="trow"><span style="color:#15803d;font-weight:600">Amount Paid</span><span style="font-weight:700;color:#15803d">₹${paidAmount.toLocaleString('en-IN')}</span></div>
        <div class="trow main"><span>Balance Due</span><span>₹${Math.max(0, total - paidAmount).toLocaleString('en-IN')}</span></div>
      </div></div>
      ${payment.finance_note ? `<div style="font-size:12px;color:#4b5563;padding:10px 14px;background:#fef3c7;border-radius:6px;margin-bottom:20px;"><strong>Note:</strong> ${payment.finance_note}</div>` : ''}
      <div class="footer"><p>${company.name}${company.gst ? ` | GST: ${company.gst}` : ''}</p><p style="margin-top:4px">This is a computer-generated receipt. No signature required.</p></div>
      </div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>📄 Receipt</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        {/* Company */}
        <div style={{ textAlign: 'center', marginBottom: '16px', padding: '16px', background: 'linear-gradient(135deg,#1e3a5f,#1f4b8f)', borderRadius: '12px', color: '#fff' }}>
          {company.logo && <img src={company.logo} alt="logo" style={{ height: '36px', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />}
          <div style={{ fontSize: '18px', fontWeight: 800 }}>{company.name}</div>
          {company.tagline && <div style={{ fontSize: '12px', opacity: 0.8 }}>{company.tagline}</div>}
        </div>

        {/* Doc info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Receipt No.</span>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{docNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Date</span>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{paidDate || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Status</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>✓ PAID</span>
        </div>

        {/* Description */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Description</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{description}</div>
        </div>

        {/* Amounts */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Total Amount</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>₹{total.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>Amount Paid</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>₹{paidAmount.toLocaleString('en-IN')}</span>
          </div>
          {total > paidAmount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>Balance Due</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>₹{(total - paidAmount).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {payment.finance_note && (
          <div style={{ background: '#fef9c3', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#854d0e', marginBottom: '16px' }}>
            <strong>Note:</strong> {payment.finance_note}
          </div>
        )}

        {/* Print */}
        <button
          onClick={handlePrint}
          style={{ width: '100%', padding: '14px', background: '#1f4b8f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🖨️ Download / Print Receipt
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// STUDENT MATERIALS PAGE (WhatsApp-style Chat)
// ─────────────────────────────────────────────────
export function StudentMaterialsPage() {
  const [teachers, setTeachers] = useState([]);
  // subjectList: [{ subject, teacher_id, teacher_name }]
  const [subjectList, setSubjectList] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Clean up preview URL on unmount or change
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    apiFetch('/students/my-teachers')
      .then(res => {
        const items = res.items || [];
        setTeachers(items);
        // Build subject-centric list: each subject is a separate entry
        const list = [];
        items.forEach(t => {
          (t.subjects || []).forEach(sub => {
            list.push({ subject: sub, teacher_id: t.teacher_id, teacher_name: t.teacher_name });
          });
        });
        // Sort by subject name
        list.sort((a, b) => a.subject.localeCompare(b.subject));
        setSubjectList(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isChatOpen && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = ''; };
  }, [isChatOpen]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchHistory = (teacherId) => {
    setLoadingHistory(true);
    apiFetch(`/students/my-materials/${teacherId}`)
      .then(res => { setChatHistory(res.items || []); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  };


  const selectSubjectEntry = (entry) => {
    // entry = { subject, teacher_id, teacher_name }
    const teacher = teachers.find(t => t.teacher_id === entry.teacher_id) || { teacher_id: entry.teacher_id, teacher_name: entry.teacher_name, subjects: [entry.subject] };
    setSelectedTeacher(teacher);
    setSelectedSubject(entry.subject);
    
    // Clear attachment on subject change
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);

    setCaptionText('');
    setMessage({ text: '', type: '' });
    fetchHistory(entry.teacher_id);
    setIsChatOpen(true);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const handleBack = () => { setIsChatOpen(false); setSelectedTeacher(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeacher || !selectedSubject) return setMessage({ text: 'Select subject.', type: 'error' });
    setSending(true);
    setMessage({ text: '', type: '' });

    let finalUrl = '';
    let finalMime = 'text/plain';

    if (file) {
      setUploading(true);
      try {
        finalMime = file.type || 'application/octet-stream';
        const preRes = await apiFetch('/upload/presigned-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, contentType: finalMime })
        });
        const uploadRes = await fetch(preRes.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': finalMime } });
        if (!uploadRes.ok) throw new Error('Upload failed');
        finalUrl = preRes.publicUrl;
        setUploading(false);
      } catch (err) {
        setUploading(false); setSending(false);
        return setMessage({ text: 'Upload failed: ' + err.message, type: 'error' });
      }
    } else if (!captionText.trim()) {
      setSending(false);
      return setMessage({ text: 'Provide a file or message.', type: 'error' });
    }

    try {
      const pushRes = await apiFetch('/students/send-material', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: selectedTeacher.teacher_id,
          subject: selectedSubject,
          file_url: finalUrl,
          mimetype: finalMime,
          caption_text: captionText,
          filename: file ? file.name : undefined
        })
      });
      setMessage({ text: pushRes.queued ? (pushRes.message || 'Queued') : (pushRes.message || 'Sent!'), type: pushRes.queued ? 'info' : 'success' });
      setFile(null); setCaptionText('');
      fetchHistory(selectedTeacher.teacher_id);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setSending(false);
  };

  const renderFilePreview = (msg) => {
    if (!msg.file_url) return null;
    const mime = (msg.mimetype || '').toLowerCase();
    if (mime.startsWith('image/')) return <a href={msg.file_url} target="_blank" rel="noreferrer"><img src={msg.file_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', display: 'block', marginBottom: '4px', objectFit: 'cover' }} /></a>;
    if (mime.startsWith('video/')) return <video controls style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', marginBottom: '4px' }}><source src={msg.file_url} type={mime} /></video>;
    if (mime.startsWith('audio/')) return <audio controls style={{ width: '100%', marginBottom: '4px' }}><source src={msg.file_url} type={mime} /></audio>;
    const ext = msg.file_url.split('.').pop()?.split('?')[0]?.toUpperCase() || 'FILE';
    return <a href={msg.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.07)', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', textDecoration: 'none', color: '#1d4ed8' }}><span style={{ fontSize: '22px' }}>{ext === 'PDF' ? '📄' : '📁'}</span><span style={{ fontSize: '13px', fontWeight: 500 }}>Open {ext} file</span></a>;
  };

  if (loading) return <><style dangerouslySetInnerHTML={{ __html: STUDENT_STYLES }} /><div className="sp-page"><div className="sp-card"><p className="sp-empty">Loading...</p></div></div></>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STUDENT_STYLES }} />
      <div className="sp-page" style={{ padding: 0 }}>
        <div className={`spm-container ${isChatOpen ? 'chat-open' : ''}`}>
          {/* Left: Subject List (subject-centric) */}
          <div className="spm-sidebar">
            <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '15px', color: '#1f4b8f' }}>📚 My Subjects</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {subjectList.map((entry, idx) => {
                const isActive = selectedTeacher?.teacher_id === entry.teacher_id && selectedSubject === entry.subject;
                const initial = (entry.subject || 'S').charAt(0).toUpperCase();
                // Simple color palette for subject icons
                const colors = ['#eff6ff', '#ecfdf5', '#fff7ed', '#fef2f2', '#f5f3ff'];
                const textColors = ['#1e40af', '#065f46', '#9a3412', '#991b1b', '#5b21b6'];
                const colorIdx = idx % colors.length;

                return (
                  <div
                    key={idx}
                    onClick={() => selectSubjectEntry(entry)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isActive ? '#eff6ff' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {isActive && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#2563eb' }} />}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: colors[colorIdx], color: textColors[colorIdx],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: 800, flexShrink: 0,
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.subject}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.teacher_name}</div>
                    </div>
                  </div>
                );
              })}
              {subjectList.length === 0 && <p className="sp-empty">No assigned subjects</p>}
            </div>
          </div>

          {/* Right: Chat */}
          <div className="spm-main">
            {selectedTeacher ? (
              <>
                <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', zIndex: 1 }}>
                  <button className="spm-mobile-back" onClick={handleBack}>←</button>
                  <div className="sp-teacher-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>{selectedTeacher.teacher_name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>{selectedTeacher.teacher_name}</div>
                    <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '1px' }}>
                      Subject: {selectedSubject}
                    </div>
                  </div>
                </div>

                <div className="spm-history">
                  {(() => {
                    if (loadingHistory) return <p className="sp-empty">Loading...</p>;
                    
                    const filtered = chatHistory.filter(msg => {
                      if (!selectedSubject) return true;
                      const sMatch = (msg.subject || '').toLowerCase() === selectedSubject.toLowerCase();
                      const tMatch = (msg.caption_text || '').toLowerCase().includes(selectedSubject.toLowerCase());
                      return sMatch || tMatch;
                    });

                    if (filtered.length === 0) {
                      return <p className="sp-empty" style={{ background: 'rgba(255,255,255,0.6)', padding: '10px', borderRadius: '8px', alignSelf: 'center' }}>No materials for "{selectedSubject}". Start below.</p>;
                    }

                    return (
                      <>
                        {filtered.map(msg => {
                          const isStudent = msg.direction === 'student_to_teacher';
                          return (
                            <div key={msg.id} style={{ alignSelf: isStudent ? 'flex-end' : 'flex-start', background: isStudent ? '#dcf8c6' : '#fff', padding: '8px 12px', borderRadius: isStudent ? '8px 0 8px 8px' : '0 8px 8px 8px', maxWidth: '85%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                              <div style={{ fontSize: '11px', color: isStudent ? '#166534' : '#1e40af', fontWeight: 600, marginBottom: '4px' }}>{msg.subject}</div>
                              {renderFilePreview(msg)}
                              {msg.caption_text && <div style={{ fontSize: '14px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.caption_text}</div>}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <span style={{ fontSize: '10px', color: '#6b7280' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {msg.status === 'sent' && <span style={{ color: '#3b82f6', fontSize: '12px' }}>✓✓</span>}
                                {msg.status === 'pending' && <span style={{ color: '#9ca3af', fontSize: '12px' }}>✓</span>}
                                {msg.status === 'failed' && <span style={{ color: '#dc2626', fontSize: '12px' }}>❌</span>}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef} />
                      </>
                    );
                  })()}
                </div>

                {/* Input Area */}
                <div style={{ padding: '10px 14px', background: '#f3f4f6', borderTop: '1px solid #e5e7eb' }}>
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedTeacher.subjects.length > 1 ? (
                        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '16px', border: '1px solid #d1d5db', outline: 'none', fontSize: '13px' }}>
                          {selectedTeacher.subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                      ) : (
                        <div style={{ flex: 1, padding: '10px 14px', background: '#e5e7eb', borderRadius: '16px', fontSize: '13px', color: '#4b5563' }}>Subject: <strong>{selectedSubject || 'None'}</strong></div>
                      )}
                      <div>
                        <input type="file" id="sp-file-upload" onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
                        <label htmlFor="sp-file-upload" style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: '16px', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>{file ? '📎 Change' : '📎 Attach'}</label>
                      </div>
                    </div>
                    {file && (
                      <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                        <button type="button" onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setFile(null); setPreviewUrl(null); }} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}>×</button>
                        
                        {previewUrl ? (
                          <div style={{ width: 44, height: 44, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                            <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                            {file.name.toLowerCase().endsWith('.pdf') ? '📄' : '📁'}
                          </div>
                        )}
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <textarea rows="2" required={!file} value={captionText} onChange={e => setCaptionText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '10px 14px', borderRadius: '16px', border: '1px solid #d1d5db', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '14px' }} />
                      <button type="submit" disabled={sending || (!file && !captionText.trim()) || !selectedSubject} style={{ width: 42, height: 42, borderRadius: '50%', background: '#1f4b8f', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1, alignSelf: 'center', fontSize: '16px' }}>
                        {sending || uploading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', borderTopColor: '#fff', animation: 'tm-spin 0.8s linear infinite', display: 'block' }} /> : '➤'}
                      </button>
                    </div>
                    {message.text && <div style={{ fontSize: '12px', textAlign: 'center', color: message.type === 'error' ? '#dc2626' : '#16a34a', fontWeight: 500 }}>{message.text}</div>}
                  </form>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>📚</div>
                  <h3 style={{ margin: '0 0 8px', color: '#111827' }}>Study Materials</h3>
                  <p style={{ color: '#6b7280', margin: 0, fontSize: '14px', maxWidth: '250px' }}>Select a teacher to view materials or send new ones.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────
// STUDENT PROFILE PAGE (Tabbed: Remarks + Teachers)
// ─────────────────────────────────────────────────
export function StudentProfilePage() {
  const [data, setData] = useState(null);
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'remarks' | 'teachers'
  const [pinForm, setPinForm] = useState({ current: '', newPin: '', confirm: '' });
  const [pinMsg, setPinMsg] = useState({ text: '', type: '' });
  const [changingPin, setChangingPin] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/students/my-dashboard'),
      apiFetch('/students/my-remarks')
    ]).then(([dashRes, remarkRes]) => {
      setData(dashRes);
      setRemarks(remarkRes.items || []);
      setLoading(false);

      // Deep link to tab via hash
      const hash = window.location.hash;
      if (hash === '#teachers') setActiveTab('teachers');
      else if (hash === '#remarks') setActiveTab('remarks');
      else if (hash === '#profile') setActiveTab('profile');
    }).catch(() => setLoading(false));
  }, []);

  const handlePinChange = async () => {
    if (pinForm.newPin.length !== 6 || !/^\d{6}$/.test(pinForm.newPin)) { setPinMsg({ text: 'New PIN must be 6 digits', type: 'error' }); return; }
    if (pinForm.newPin !== pinForm.confirm) { setPinMsg({ text: 'PINs do not match', type: 'error' }); return; }
    setChangingPin(true);
    try {
      await apiFetch('/students/change-pin', {
        method: 'POST',
        body: JSON.stringify({ current_pin: pinForm.current, new_pin: pinForm.newPin })
      });
      setPinMsg({ text: 'PIN changed successfully! ✅', type: 'success' });
      setPinForm({ current: '', newPin: '', confirm: '' });
      setTimeout(() => setPinMsg({ text: '', type: '' }), 3000);
    } catch (err) {
      setPinMsg({ text: err.message, type: 'error' });
    }
    setChangingPin(false);
  };

  const remarkTypeColor = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'exam') return 'type-exam';
    if (t === 'attendance') return 'type-attendance';
    if (t === 'behaviour') return 'type-behaviour';
    if (t.includes('parent') || t.includes('meeting')) return 'type-parents_meeting';
    return 'type-general';
  };

  const remarkTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'exam') return 'sp-badge-blue';
    if (t === 'attendance') return 'sp-badge-orange';
    if (t === 'behaviour') return 'sp-badge-red';
    if (t.includes('parent') || t.includes('meeting')) return 'sp-badge-purple';
    return 'sp-badge-green';
  };

  const s = data?.student || {};
  const assignments = groupTeachers(data?.assignments || []);

  const tabStyle = (tab) => ({
    flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '11px', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px',
    color: activeTab === tab ? '#1f4b8f' : '#94a3b8',
    borderBottom: activeTab === tab ? '2px solid #1f4b8f' : '2px solid transparent',
    transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STUDENT_STYLES }} />
      <div className="sp-page">
        <div className="sp-card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Tab Headers (Scrollable if overflow) */}
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}>
            <style dangerouslySetInnerHTML={{ __html: 'div::-webkit-scrollbar { display: none; }' }} />
            <button style={{ ...tabStyle('profile'), flex: '0 0 auto', minWidth: '90px' }} onClick={() => setActiveTab('profile')}>
              {ICONS.user(activeTab === 'profile' ? '#1f4b8f' : '#94a3b8')} Profile
            </button>
            <button style={{ ...tabStyle('remarks'), flex: '0 0 auto', minWidth: '100px' }} onClick={() => setActiveTab('remarks')}>
              {ICONS.remarks(activeTab === 'remarks' ? '#1f4b8f' : '#94a3b8')} Remarks {remarks.length > 0 && <span style={{ background: activeTab === 'remarks' ? '#1f4b8f' : '#cbd5e1', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '9px' }}>{remarks.length}</span>}
            </button>
            <button style={{ ...tabStyle('teachers'), flex: '0 0 auto', minWidth: '110px' }} onClick={() => setActiveTab('teachers')}>
              {ICONS.teachers(activeTab === 'teachers' ? '#166534' : '#94a3b8')} Teachers {assignments.length > 0 && <span style={{ background: activeTab === 'teachers' ? '#166534' : '#cbd5e1', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '9px' }}>{assignments.length}</span>}
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {activeTab === 'profile' && (
              <div className="sp-grid-2">
                <div style={{ marginBottom: '24px' }}>
                  <div className="sp-profile-field"><span className="sp-profile-key">Name</span><span className="sp-profile-val">{s.student_name || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Student Code</span><span className="sp-profile-val">{s.student_code || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Class</span><span className="sp-profile-val">{s.class_level || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Board</span><span className="sp-profile-val">{s.board || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Medium</span><span className="sp-profile-val">{s.medium || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Country</span><span className="sp-profile-val">{s.country || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Contact</span><span className="sp-profile-val">{s.contact_number || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">AC Coordinator</span><span className="sp-profile-val">{s.ac_name || '—'}</span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Status</span><span className="sp-profile-val"><span className={`sp-badge ${s.status === 'active' ? 'sp-badge-green' : 'sp-badge-yellow'}`}>{s.status || '—'}</span></span></div>
                  <div className="sp-profile-field"><span className="sp-profile-key">Hours</span><span className="sp-profile-val">{s.remaining_hours || 0} / {s.total_hours || 0}</span></div>
                </div>

                <div className="sp-desktop-security-panel" style={{ borderTop: window.innerWidth < 1024 ? '2px solid #f1f5f9' : 'none', paddingTop: window.innerWidth < 1024 ? '20px' : '0', paddingLeft: window.innerWidth < 1024 ? '0' : '24px', borderLeft: window.innerWidth < 1024 ? 'none' : '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', display: 'flex' }}>{ICONS.lock()}</span>
                    Security (Change PIN)
                  </div>
                  <div className="sp-pin-form">
                    <input className="sp-pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="Current PIN" value={pinForm.current} onChange={e => setPinForm(f => ({ ...f, current: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                    <input className="sp-pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="New 6-Digit PIN" value={pinForm.newPin} onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                    <input className="sp-pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="Confirm New PIN" value={pinForm.confirm} onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                    <button className="sp-pin-btn" disabled={changingPin || pinForm.newPin.length !== 6} onClick={handlePinChange}>
                      {changingPin ? 'Updating...' : 'Update PIN'}
                    </button>
                    {pinMsg.text && <div className={pinMsg.type === 'success' ? 'sp-pin-success' : 'sp-pin-error'}>{pinMsg.text}</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'remarks' && (
              remarks.length === 0 ? <p className="sp-empty">No remarks yet</p> : (
                <div className="sp-remark-timeline">
                  {remarks.map(r => (
                    <div key={r.id} className={`sp-remark-item ${remarkTypeColor(r.remark_type)}`}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                        <span className={`sp-badge ${remarkTypeBadge(r.remark_type)}`}>{r.remark_type || 'General'}</span>
                        {r.marks !== null && r.marks !== undefined && <span className="sp-badge sp-badge-blue">Marks: {r.marks}</span>}
                      </div>
                      <div className="sp-remark-title">{r.title || 'Remark'}</div>
                      {r.description && <div className="sp-remark-desc">{r.description}</div>}
                      <div className="sp-remark-meta">
                        <span>By: {r.creator?.full_name || 'Staff'}</span>
                        <span>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'teachers' && (
              assignments.length === 0 ? <p className="sp-empty">No teachers assigned yet</p> : (
                <>
                  {assignments.map((a, i) => (
                    <div key={i} className="sp-teacher-list-item">
                      <div className="sp-teacher-avatar">{a.teacher_name.charAt(0).toUpperCase()}</div>
                      <div className="sp-teacher-info">
                        <div className="sp-teacher-name">{a.teacher_name}</div>
                        <div className="sp-teacher-subj">{a.subjects.join(', ')}</div>
                      </div>
                    </div>
                  ))}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
