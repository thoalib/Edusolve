import React from 'react';

export function Pagination({ page, limit, total, onPageChange }) {
    if (total === 0) return null;

    const totalPages = Math.ceil(total / limit);
    const startItem = (page - 1) * limit + 1;
    const endItem = Math.min(page * limit, total);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            background: 'white',
            borderRadius: '0 0 8px 8px',
            marginTop: '-8px' // offset card bottom padding if any
        }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Showing <span style={{ fontWeight: 500, color: '#111827' }}>{startItem}</span> to <span style={{ fontWeight: 500, color: '#111827' }}>{endItem}</span> of <span style={{ fontWeight: 500, color: '#111827' }}>{total}</span> results
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    className="secondary small"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    style={{ padding: '6px 12px' }}
                >
                    Previous
                </button>

                <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    minWidth: '32px'
                }}>
                    {page}
                </span>

                <button
                    className="secondary small"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    style={{ padding: '6px 12px' }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
