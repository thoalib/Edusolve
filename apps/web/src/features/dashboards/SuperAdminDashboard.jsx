import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { DashboardDateFilter } from './CounselorDashboards.jsx';
import { toLocalISO } from '../../lib/dateUtils.js';

function CurrencyDisplay({ value, prefix = '₹', style = {} }) {
    const val = Number(value) || 0;
    const parts = val.toFixed(2).split('.');
    return (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', ...style }}>
            <span>{prefix}{Number(parts[0]).toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '0.65em', opacity: 0.75, fontWeight: 600, marginLeft: '1px' }}>.{parts[1]}</span>
        </span>
    );
}

function getThisMonthRange() {
    const now = new Date();
    return {
        from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toLocalISO(now)
    };
}

export function SuperAdminDashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(getThisMonthRange);

    useEffect(() => {
        setLoading(true);
        const params = `from=${dateRange.from}&to=${dateRange.to}`;
        apiFetch(`/dashboard/super-admin?${params}`)
            .then(res => setStats(res.stats))
            .catch(err => console.error('Failed to load super admin stats', err))
            .finally(() => setLoading(false));
    }, [dateRange]);

    return (
        <section className="panel">
            <DashboardDateFilter onChange={setDateRange} />

            {loading && !stats ? (
                <p>Loading system overview...</p>
            ) : !stats ? (
                <p className="error">Failed to load system stats</p>
            ) : (() => {
                const { leads, students, teachers, finance } = stats;
                return (
                    <>
                        {/* ── Financial Health ── */}
                        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>Financial Health</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            <article className="card stat-card success">
                                <p className="eyebrow">Total Revenue</p>
                                <h3><CurrencyDisplay value={finance.income} /></h3>
                            </article>
                            <article className="card stat-card danger">
                                <p className="eyebrow">Total Expenses</p>
                                <h3><CurrencyDisplay value={finance.expenses} /></h3>
                            </article>
                            <article className="card stat-card">
                                <p className="eyebrow">Net Profit</p>
                                <h3 style={{ color: finance.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    <CurrencyDisplay value={finance.net} prefix="₹" />
                                </h3>
                            </article>

                            <article className="card stat-card warning">
                                <p className="eyebrow">Payable to Teachers (All Time)</p>
                                <h3><CurrencyDisplay value={finance.teacherPayable} /></h3>
                                <p style={{ margin: '4px 0 0', fontSize: '10px', opacity: 0.7 }}>Billed & Due (System Total)</p>
                            </article>
                            <article className="card stat-card" style={{ borderColor: '#facc15', background: '#fefce8' }}>
                                <p className="eyebrow" style={{ color: '#a16207' }}>Estimated Payroll (Total Unpaid)</p>
                                <h3 style={{ color: '#a16207' }}><CurrencyDisplay value={finance.estimatedPayable} /></h3>
                                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#a16207', opacity: 0.8 }}>Estimate for all unbilled work</p>
                            </article>
                            <article className="card stat-card info">
                                <p className="eyebrow">Pending Incoming (Total)</p>
                                <h3><CurrencyDisplay value={finance.pendingIncoming} /></h3>
                                <p style={{ margin: '4px 0 0', fontSize: '10px', opacity: 0.7 }}>Total unpaid student fees</p>
                            </article>
                        </div>

                        <div className="grid-two" style={{ marginTop: '24px' }}>
                            {/* ── Sales Pipeline ── */}
                            <div className="card" style={{ padding: '20px' }}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Sales Pipeline</h3>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span className="text-muted">Total Leads</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px' }}>{leads.total}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span className="text-muted">New Leads</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)' }}>{leads.new}</span>
                                </div>
                                <div style={{ marginTop: '16px', background: 'var(--surface-soft)', borderRadius: '8px', padding: '12px' }}>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>PIPELINE HEALTH</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '14px' }}>
                                        {leads.new > 0 ? '🟢 Active Inflow' : '🔴 Low Inflow'}
                                    </p>
                                </div>
                            </div>

                            {/* ── Academic Overview ── */}
                            <div className="card" style={{ padding: '20px' }}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Academic Overview</h3>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span className="text-muted">Active Students</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--success)' }}>{students.total}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span className="text-muted">Active Teachers</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px' }}>{teachers.total}</span>
                                </div>
                                <div style={{ marginTop: '16px', background: 'var(--surface-soft)', borderRadius: '8px', padding: '12px' }}>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>TEACHER : STUDENT RATIO</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '14px' }}>
                                        1 : {teachers.total > 0 ? Math.round(students.total / teachers.total) : 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Quick Actions ── */}
                        <div style={{ marginTop: '32px' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Quick Actions</h3>
                            <div className="grid-four">
                                <a href="/admin/users" className="card action-card" style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                                    <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '28px', height: '28px' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                        </svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>User Management</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Manage staff logins & roles</p>
                                </a>
                                <a href="/finance/reports" className="card action-card" style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                                    <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '28px', height: '28px' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                                        </svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>Finance Reports</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>View income & expenses</p>
                                </a>
                                <a href="/teachers/pool" className="card action-card" style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                                    <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '28px', height: '28px' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                        </svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>Teacher Pool</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Browse active database</p>
                                </a>
                                <a href="/students/hub" className="card action-card" style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                                    <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '28px', height: '28px' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                                        </svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>Student Hub</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Manage enrollments</p>
                                </a>
                            </div>
                        </div>
                    </>
                );
            })()}
        </section>
    );
}
