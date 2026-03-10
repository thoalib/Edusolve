import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../lib/api.js';

const PAGE_SIZE = 15;

function StatusBadge({ status }) {
    if (status === 'sent') return <span style={{ color: '#15803d', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>✅ Sent</span>;
    if (status === 'pending') return <span style={{ color: '#92400e', fontWeight: 600, background: '#fef9c3', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>⏳ Pending</span>;
    if (status === 'failed') return <span style={{ color: '#991b1b', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>❌ Failed</span>;
    return <span style={{ color: '#6b7280', fontSize: 12 }}>{status}</span>;
}

export function MaterialTransfersPage() {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retryingId, setRetryingId] = useState(null);
    const [tab, setTab] = useState('failed'); // 'failed' | 'all'
    const [page, setPage] = useState(1);
    const [viewItem, setViewItem] = useState(null); // modal

    const fetchTransfers = () => {
        setLoading(true);
        apiFetch('/academic/material-transfers')
            .then(res => {
                setTransfers(res.items || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchTransfers(); }, []);

    // Reset page when tab changes
    useEffect(() => { setPage(1); }, [tab]);

    const handleRetry = async (id) => {
        setRetryingId(id);
        try {
            const res = await apiFetch(`/academic/material-transfers/${id}/retry`, { method: 'POST' });
            if (res.ok) {
                fetchTransfers();
            } else {
                alert('Retry Failed: ' + res.error);
            }
        } catch (err) {
            alert('Retry Error: ' + err.message);
        }
        setRetryingId(null);
    };

    const filteredItems = useMemo(() => {
        if (tab === 'failed') return transfers.filter(t => t.status === 'failed' || t.status === 'pending');
        return transfers;
    }, [transfers, tab]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const failedCount = transfers.filter(t => t.status === 'failed' || t.status === 'pending').length;

    const tabBtn = (id, label, count) => (
        <button
            onClick={() => setTab(id)}
            style={{
                padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === id ? 'var(--primary, #2563eb)' : 'var(--surface-alt, #f3f4f6)',
                color: tab === id ? '#fff' : '#374151',
                transition: 'all 0.15s'
            }}
        >
            {label}{count > 0 ? <span style={{ marginLeft: 6, background: tab === id ? 'rgba(255,255,255,0.25)' : '#e5e7eb', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{count}</span> : null}
        </button>
    );

    return (
        <section className="panel" style={{ maxWidth: '1100px', margin: '0 auto' }}>

            {/* View Modal */}
            {viewItem && (
                <div onClick={() => setViewItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <strong style={{ fontSize: 15 }}>Transfer Details</strong>
                            <button onClick={() => setViewItem(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                            <div><span style={{ color: '#6b7280' }}>Teacher:</span> <b>{viewItem.users?.full_name || 'Unknown'}</b></div>
                            <div><span style={{ color: '#6b7280' }}>Student:</span> <b>{viewItem.students?.student_name || 'Unknown'}</b></div>
                            <div><span style={{ color: '#6b7280' }}>Subject:</span> <b>{viewItem.subject}</b></div>
                            <div><span style={{ color: '#6b7280' }}>Date:</span> {new Date(viewItem.created_at).toLocaleString()}</div>
                            <div style={{ marginTop: 4 }}>
                                <div style={{ color: '#6b7280', marginBottom: 4 }}>Message / Caption:</div>
                                <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.5 }}>
                                    {viewItem.caption_text || <em style={{ color: '#9ca3af' }}>No text</em>}
                                </div>
                            </div>
                            {viewItem.file_url && (
                                <a href={viewItem.file_url} target="_blank" rel="noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', textDecoration: 'underline' }}>
                                    📄 Open File
                                </a>
                            )}
                            {viewItem.status === 'failed' && viewItem.error_message && (
                                <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', color: '#991b1b', fontSize: 12 }}>
                                    ⚠️ {viewItem.error_message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>
                        Study materials sent by teachers to your assigned students.
                    </p>
                </div>
                <button onClick={fetchTransfers} disabled={loading}
                    style={{ padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    {loading ? 'Loading...' : '↻ Refresh'}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {tabBtn('failed', '⚠️ Failed / Pending', failedCount)}
                {tabBtn('all', '📋 All Transfers', transfers.length)}
            </div>

            {/* Table */}
            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Teacher</th>
                            <th>Student</th>
                            <th>Subject</th>
                            <th>File / Media</th>
                            <th>Status</th>
                            {tab === 'failed' && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map(tr => (
                            <tr key={tr.id}>
                                <td data-label="Date" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {new Date(tr.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td data-label="Teacher">{tr.users?.full_name || 'Unknown'}</td>
                                <td data-label="Student">{tr.students?.student_name || 'Unknown'}</td>
                                <td data-label="Subject">{tr.subject}</td>
                                <td data-label="Media">
                                    {tr.file_url ? (
                                        <a href={tr.file_url} target="_blank" rel="noreferrer"
                                            style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '13px' }}>
                                            📄 View File
                                        </a>
                                    ) : (
                                        <span style={{ fontSize: '13px', color: '#6b7280' }}>💬 Text Only</span>
                                    )}
                                </td>
                                <td data-label="Status">
                                    <StatusBadge status={tr.status} />
                                    {tr.error_message && (
                                        <div style={{ fontSize: 11, color: '#991b1b', marginTop: 3, maxWidth: 180, wordBreak: 'break-word' }}>{tr.error_message}</div>
                                    )}
                                </td>
                                <td data-label="Actions">
                                    {tab === 'failed' && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => setViewItem(tr)}
                                                style={{ padding: '5px 11px', fontSize: '12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
                                            >
                                                👁 View
                                            </button>
                                            {(tr.status === 'failed' || tr.status === 'pending') && (
                                                <button
                                                    onClick={() => handleRetry(tr.id)}
                                                    disabled={retryingId === tr.id}
                                                    style={{ padding: '5px 11px', fontSize: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                                >
                                                    {retryingId === tr.id ? 'Retrying...' : '↺ Retry'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {pageItems.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                                    {tab === 'failed' ? '✅ No failed or pending transfers!' : 'No material transfers found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, paddingBottom: 8 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, flexShrink: 0 }}>
                        ← Prev
                    </button>
                    <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, flexShrink: 0 }}>
                        Next →
                    </button>
                </div>
            )}
        </section>
    );
}
