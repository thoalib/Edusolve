
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api.js';

export function LeadFilters({ onFilterChange, counselors = [], userRole, actionButton, children }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [counselorId, setCounselorId] = useState('');
    const [leadType, setLeadType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
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
        <div className="card filters-bar mobile-filters-grid">
            <div className="filter-group mobile-full-width" style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                />
                <button
                    type="button"
                    className={`secondary mobile-only-flex ${filtersOpen ? 'primary' : ''}`}
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                </button>
                {actionButton}
            </div>

            <div className={`filter-group ${!filtersOpen ? 'mobile-hidden' : ''}`}>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="demo_scheduled">Demo Scheduled</option>
                    <option value="demo_done">Demo Done</option>
                    <option value="payment_pending">Payment Pending</option>
                    <option value="payment_verification">Payment Verification</option>
                    <option value="joined">Joined</option>
                    <option value="dropped">Dropped</option>
                </select>
            </div>

            {counselors && counselors.length > 0 && userRole !== 'counselor' && (
                <div className={`filter-group ${!filtersOpen ? 'mobile-hidden' : ''}`}>
                    <select value={counselorId} onChange={e => setCounselorId(e.target.value)}>
                        <option value="">All Counselors</option>
                        {counselors.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className={`filter-group ${!filtersOpen ? 'mobile-hidden' : ''}`}>
                <select value={leadType} onChange={e => setLeadType(e.target.value)}>
                    <option value="">All Types</option>
                    {leadTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            <div className={`filter-group ${!filtersOpen ? 'mobile-hidden' : ''}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)} 
                    title="From Date"
                />
                <span style={{color: '#6b7280'}}>-</span>
                <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)} 
                    title="To Date"
                />
            </div>

            <div className={`filters-actions ${!filtersOpen ? 'mobile-hidden' : ''}`} style={{ display: 'flex', gap: '8px', flex: '1 1 auto', flexWrap: 'wrap' }}>
                {children}
            </div>
        </div>
    );
}
