
import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../lib/api.js';

export function NotificationBell({ onNavigateToTicket }) {
    const [count, setCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);

    // Poll unread count every 30 secs
    useEffect(() => {
        loadCount();
        const interval = setInterval(loadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        function handleOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    async function loadCount() {
        try {
            const res = await apiFetch('/notifications/count');
            setCount(res.count || 0);
        } catch (e) { /* silent */ }
    }

    async function loadNotifications() {
        setLoading(true);
        try {
            const res = await apiFetch('/notifications?limit=10');
            setItems(res.items || []);
        } catch (e) { /* silent */ }
        setLoading(false);
    }

    function handleToggle() {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen) loadNotifications();
    }

    async function handleMarkAllRead() {
        try {
            await apiFetch('/notifications/read-all', { method: 'PATCH' });
            setCount(0);
            setItems(prev => prev.map(i => ({ ...i, is_read: true })));
        } catch (e) { /* silent */ }
    }

    async function handleClick(item) {
        // Mark as read
        if (!item.is_read) {
            try {
                await apiFetch(`/notifications/${item.id}/read`, { method: 'PATCH' });
                setCount(c => Math.max(0, c - 1));
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_read: true } : i));
            } catch (e) { /* silent */ }
        }
        setOpen(false);
        if (item.reference_id && onNavigateToTicket) {
            onNavigateToTicket(item.reference_id);
        }
    }

    function timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    return (
        <div className="notification-bell-wrap" ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                className="notification-bell-btn"
                onClick={handleToggle}
                title="Notifications"
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
                    fontSize: '20px', padding: '6px 8px', color: '#94a3b8'
                }}
            >
                🔔
                {count > 0 && (
                    <span style={{
                        position: 'absolute', top: 2, right: 2,
                        background: '#ef4444', color: '#fff', borderRadius: '50%',
                        fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', lineHeight: 1
                    }}>{count > 9 ? '9+' : count}</span>
                )}
            </button>

            {open && (
                <div className="notification-dropdown" style={{
                    position: 'absolute', top: '100%', right: 0, width: '340px',
                    background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,.4)', zIndex: 9999,
                    maxHeight: '420px', display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderBottom: '1px solid #334155'
                    }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>Notifications</span>
                        {count > 0 && (
                            <button onClick={handleMarkAllRead} style={{
                                background: 'none', border: 'none', color: '#818cf8',
                                cursor: 'pointer', fontSize: '12px'
                            }}>Mark all read</button>
                        )}
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {loading && <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
                        {!loading && items.length === 0 && (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No notifications</div>
                        )}
                        {items.map(item => (
                            <div
                                key={item.id}
                                onClick={() => handleClick(item)}
                                style={{
                                    padding: '10px 16px', cursor: 'pointer',
                                    borderBottom: '1px solid #334155',
                                    background: item.is_read ? 'transparent' : 'rgba(99,102,241,.08)',
                                    transition: 'background .15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = item.is_read ? 'transparent' : 'rgba(99,102,241,.08)'}
                            >
                                <div style={{
                                    fontSize: '13px', fontWeight: item.is_read ? 400 : 600,
                                    color: '#f1f5f9', marginBottom: '2px'
                                }}>
                                    {!item.is_read && <span style={{ color: '#818cf8', marginRight: '6px' }}>●</span>}
                                    {item.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>{item.message}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{timeAgo(item.created_at)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
