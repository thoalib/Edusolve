import { useState } from 'react';
import { apiFetch } from '../lib/api.js';

export function PushNotificationPrompt() {
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    const enablePush = async () => {
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted' && navigator.serviceWorker) {
                const reg = await navigator.serviceWorker.ready;
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (vapidKey) {
                    const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: vapidKey
                    });
                    if (sub) {
                        await apiFetch('/push/subscribe', {
                            method: 'POST',
                            body: JSON.stringify(sub)
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (permission === 'granted' || permission === 'denied') return null;

    return (
        <div style={{ background: 'linear-gradient(to right, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>🔔</div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af', marginBottom: '2px' }}>Enable Notifications</div>
                    <div style={{ fontSize: '12px', color: '#3b82f6' }}>Get immediate alerts for ticket updates and important announcements.</div>
                </div>
            </div>
            <button onClick={enablePush} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Turn On
            </button>
        </div>
    );
}
