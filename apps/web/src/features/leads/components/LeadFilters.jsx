
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api.js';

export function LeadFilters({ onFilterChange, counselors = [], userRole, actionButton, children }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [counselorId, setCounselorId] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    // debounce search could be added later

    useEffect(() => {
        onFilterChange({ search, status, counselorId });
    }, [search, status, counselorId]);

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
            <div className={`filters-actions ${!filtersOpen ? 'mobile-hidden' : ''}`} style={{ display: 'flex', gap: '8px', flex: '1 1 auto', flexWrap: 'wrap' }}>
                {children}
            </div>
        </div>
    );
}
