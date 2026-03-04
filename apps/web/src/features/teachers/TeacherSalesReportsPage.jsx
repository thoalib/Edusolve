import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../../lib/api.js';

export function TeacherSalesReportsPage() {
    const [stats, setStats] = useState(null);
    const [coordinatorMap, setCoordinatorMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    async function generateReport() {
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams();
            if (fromDate) query.append('from', new Date(fromDate).toISOString());
            if (toDate) query.append('to', new Date(toDate).toISOString());

            const data = await apiFetch(`/teacher-leads/coordinator-stats?${query.toString()}`);
            setStats(data.stats);
            setCoordinatorMap(data.coordinatorMap || {});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        generateReport();
    }, []);

    const reportData = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats).map(([id, s]) => {
            const conversionRate = s.total > 0 ? ((s.approved / s.total) * 100).toFixed(1) : '0.0';
            return {
                id,
                name: id === 'unassigned' ? 'Unassigned' : (coordinatorMap[id] || id),
                total: s.total,
                active: s.active,
                approved: s.approved,
                rejected: s.rejected,
                conversionRate: conversionRate + '%'
            };
        }).sort((a, b) => b.approved - a.approved);
    }, [stats, coordinatorMap]);

    const totals = useMemo(() => {
        return reportData.reduce((acc, r) => ({
            total: acc.total + r.total,
            active: acc.active + r.active,
            approved: acc.approved + r.approved,
            rejected: acc.rejected + r.rejected
        }), { total: 0, active: 0, approved: 0, rejected: 0 });
    }, [reportData]);

    return (
        <section className="panel">

            <div className="card filters-bar" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>Start Date</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>End Date</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <button onClick={generateReport} className="primary" disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
            </div>

            {error ? <p className="error">{error}</p> : null}

            {/* Summary Cards */}
            {reportData.length > 0 && (
                <div className="grid-four" style={{ marginBottom: '16px' }}>
                    <div className="card stat-card">
                        <p className="stat-label">Total Leads</p>
                        <p className="stat-value">{totals.total}</p>
                    </div>
                    <div className="card stat-card">
                        <p className="stat-label">Active</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>{totals.active}</p>
                    </div>
                    <div className="card stat-card">
                        <p className="stat-label">Approved (Won)</p>
                        <p className="stat-value" style={{ color: '#10b981' }}>{totals.approved}</p>
                    </div>
                    <div className="card stat-card">
                        <p className="stat-label">Rejected (Lost)</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>{totals.rejected}</p>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Coordinator</th>
                                <th>Total Leads</th>
                                <th>Active</th>
                                <th>Approved (Won)</th>
                                <th>Rejected (Lost)</th>
                                <th>Conversion Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                                    <td>{row.total}</td>
                                    <td>{row.active}</td>
                                    <td style={{ color: '#10b981', fontWeight: 500 }}>{row.approved}</td>
                                    <td style={{ color: '#ef4444' }}>{row.rejected}</td>
                                    <td>{row.conversionRate}</td>
                                </tr>
                            ))}
                            {!reportData.length && !loading ? (
                                <tr><td colSpan="6">No data available.</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
