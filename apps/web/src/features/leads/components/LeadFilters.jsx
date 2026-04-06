import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api.js';

const STUDENT_LEAD_NOTES = {
    new: ["Ringing, not picked up", "Switched off", "Call back later", "Busy", "Not reachable"],
    contacted: ["Asked to send details on WhatsApp", "Not interested right now", "Needs discussion with parents", "Wrong number"],
    demo_scheduled: ["Student requested reschedule", "Teacher unavailable", "Reminded about demo"],
    demo_done: ["Waiting for feedback", "Not completely satisfied", "Reviewing with parents"],
    payment_pending: ["Requested more time", "Payment link sent again", "Waiting for salary"],
    payment_verification: ["Document sent to finance", "Checking transaction ID"],
    joined: ["Onboarding complete"],
    dropped: ["Invalid number"]
};

export function LeadFilters({ onFilterChange, counselors = [], userRole, noteFilter, onNoteFilterChange }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [counselorId, setCounselorId] = useState('');
    const [leadType, setLeadType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [leadTypes, setLeadTypes] = useState([]);

    useEffect(() => {
        apiFetch('/leads/types').then(res => {
            if (res.ok) setLeadTypes(res.types || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        onFilterChange({ search, status, counselorId, leadType, dateFrom, dateTo });
    }, [search, status, counselorId, leadType, dateFrom, dateTo]);

    return (
        <div className="card filters-bar" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb' }}>
            {/* Search */}
            <div style={{ flex: '1.5 1 180px', minWidth: '150px' }}>
                <input
                    type="text"
                    placeholder="Search name, phone, or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', outline: 'none' }}
                />
            </div>

            {/* Status */}
            <div style={{ flex: '1 1 130px' }}>
                <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', background: 'white', outline: 'none' }}
                >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="demo_scheduled">Demo Scheduled</option>
                    <option value="demo_done">Demo Done</option>
                    <option value="payment_pending">Payment Pending</option>
                    <option value="payment_verification">Payment Verification</option>
                    <option value="joined">Joined</option>
                    <option value="dropped">Dropped</option>
                </select>
            </div>

            {/* Note Filter (Dynamic) */}
            {status && status !== 'dropped' && status !== 'joined' && onNoteFilterChange && (
                <div style={{ flex: '1 1 150px' }}>
                    <select 
                        value={noteFilter} 
                        onChange={e => onNoteFilterChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', border: '1.5px solid #6366f1', background: 'white', outline: 'none', color: '#4f46e5', fontWeight: 500 }}
                    >
                        <option value="all">Note: All</option>
                        <option value="none">Note: None</option>
                        {(STUDENT_LEAD_NOTES[status] || []).map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                        <option value="other">Note: Other</option>
                    </select>
                </div>
            )}

            {/* Counselor (Admin/Head only) */}
            {counselors && counselors.length > 0 && userRole !== 'counselor' && (
                <div style={{ flex: '1 1 150px' }}>
                    <select 
                        value={counselorId} 
                        onChange={e => setCounselorId(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', background: 'white', outline: 'none' }}
                    >
                        <option value="">All Counselors</option>
                        {counselors.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Lead Type */}
            <div style={{ flex: '1 1 130px' }}>
                <select 
                    value={leadType} 
                    onChange={e => setLeadType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', background: 'white', outline: 'none' }}
                >
                    <option value="">All Types</option>
                    {leadTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            {/* Date Range */}
            <div style={{ flex: '0 0 auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)} 
                    title="From Date"
                    style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', outline: 'none' }}
                />
                <span style={{color: '#9ca3af'}}>–</span>
                <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)} 
                    title="To Date"
                    style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d1d5db', outline: 'none' }}
                />
            </div>
        </div>
    );
}
