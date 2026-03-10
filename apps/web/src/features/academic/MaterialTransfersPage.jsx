import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';

export function MaterialTransfersPage() {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retryingId, setRetryingId] = useState(null);

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

    useEffect(() => {
        fetchTransfers();
    }, []);

    const handleRetry = async (id) => {
        setRetryingId(id);
        try {
            const res = await apiFetch(`/academic/material-transfers/${id}/retry`, { method: 'POST' });
            if (res.ok) {
                alert('Success! ' + res.message);
                fetchTransfers();
            } else {
                alert('Retry Failed: ' + res.error);
            }
        } catch (err) {
            alert('Retry Error: ' + err.message);
        }
        setRetryingId(null);
    };

    return (
        <section className="panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ marginBottom: '8px' }}>Material Transfers</h2>
                    <p style={{ color: '#4b5563', fontSize: '14px', margin: 0 }}>
                        View study materials sent by teachers to your assigned students. You can manually retry failed transfers here.
                    </p>
                </div>
                <button onClick={fetchTransfers} disabled={loading} style={{ padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

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
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transfers.map(tr => (
                            <tr key={tr.id}>
                                <td data-label="Date" style={{ fontSize: '12px' }}>
                                    {new Date(tr.created_at).toLocaleString()}
                                </td>
                                <td data-label="Teacher">{tr.users?.full_name || 'Unknown'}</td>
                                <td data-label="Student">{tr.students?.student_name || 'Unknown'}</td>
                                <td data-label="Subject">{tr.subject}</td>
                                <td data-label="Media">
                                    {tr.file_url ? (
                                        <a href={tr.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '13px' }}>
                                            View File
                                        </a>
                                    ) : (
                                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Text Only</span>
                                    )}
                                </td>
                                <td data-label="Status">
                                    {tr.status === 'sent' && <span style={{ color: '#15803d', fontWeight: 600 }}>Sent</span>}
                                    {tr.status === 'pending' && <span style={{ color: '#ca8a04', fontWeight: 600 }}>Pending</span>}
                                    {tr.status === 'failed' && (
                                        <div>
                                            <span style={{ color: '#dc2626', fontWeight: 600, display: 'block' }}>Failed</span>
                                            <span style={{ fontSize: '11px', color: '#991b1b' }}>{tr.error_message}</span>
                                        </div>
                                    )}
                                </td>
                                <td data-label="Actions">
                                    {(tr.status === 'failed' || tr.status === 'pending') && (
                                        <button
                                            onClick={() => handleRetry(tr.id)}
                                            disabled={retryingId === tr.id}
                                            style={{ padding: '6px 12px', fontSize: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            {retryingId === tr.id ? 'Retrying...' : 'Retry Now'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {transfers.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                                    No material transfers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
