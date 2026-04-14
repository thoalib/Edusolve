import { readJson, sendJson } from '../common/http.js';
import { PushService } from './push.service.js';

const pushService = new PushService();

export async function handlePush(req, res, url) {
    if (!req.url.startsWith('/push')) return false;

    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!role || !userId) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return true;
    }

    try {
        // POST /push/subscribe - Save push subscription for user
        if (req.method === 'POST' && url.pathname === '/push/subscribe') {
            const subscription = await readJson(req);
            const result = await pushService.saveSubscription(userId, subscription);
            sendJson(res, result.error ? 500 : 200, result);
            return true;
        }

        // POST /push/broadcast - Admin broadcast
        if (req.method === 'POST' && url.pathname === '/push/broadcast') {
            if (role !== 'super_admin') {
                sendJson(res, 403, { error: 'Forbidden' });
                return true;
            }
            const payload = await readJson(req);
            const result = await pushService.broadcast(payload);
            sendJson(res, result.error ? 500 : 200, result);
            return true;
        }

        // GET /push/config - Get global push config
        if (req.method === 'GET' && url.pathname === '/push/config') {
             if (role !== 'super_admin') {
                sendJson(res, 403, { error: 'Forbidden' });
                return true;
            }
            const result = await pushService.getConfig();
            sendJson(res, result.error ? 500 : 200, result);
            return true;
        }
        
        // PATCH /push/config - Update global push config
        if (req.method === 'PATCH' && url.pathname === '/push/config') {
            if (role !== 'super_admin') {
                sendJson(res, 403, { error: 'Forbidden' });
                return true;
            }
            const payload = await readJson(req);
            const result = await pushService.updateConfig(payload);
            sendJson(res, result.error ? 500 : 200, result);
            return true;
        }

        sendJson(res, 404, { error: 'Not found' });
        return true;
    } catch (e) {
        console.error('[Push Error]', e);
        sendJson(res, 500, { error: e.message });
        return true;
    }
}
