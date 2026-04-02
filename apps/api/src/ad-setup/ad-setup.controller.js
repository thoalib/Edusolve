import { readJson, sendJson } from '../common/http.js';
import { AdSetupService } from './ad-setup.service.js';

const adSetupService = new AdSetupService();

function getUserFromHeader(req) {
  const rawRole = req.headers['x-user-role'];
  const rawId = req.headers['x-user-id'];
  return {
    userId: typeof rawId === 'string' && rawId ? rawId : 'dev-user',
    role: typeof rawRole === 'string' ? rawRole : 'counselor'
  };
}

export async function handleAdSetups(req, res, url) {
  if (!req.url.startsWith('/ad-setups')) return false;

  const actor = getUserFromHeader(req);

  try {
    if (req.method === 'GET' && url.pathname === '/ad-setups') {
      const result = await adSetupService.list(actor);
      if (result?.error) {
        sendJson(res, 403, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/ad-setups') {
      const payload = await readJson(req);
      const result = await adSetupService.create(payload, actor);
      if (result?.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 201, { ok: true, item: result });
      return true;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 2 && req.method === 'PATCH') {
      const id = parts[1];
      const payload = await readJson(req);
      const result = await adSetupService.update(id, payload, actor);
      if (result?.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, item: result });
      return true;
    }

    if (parts.length === 2 && req.method === 'DELETE') {
      const id = parts[1];
      const result = await adSetupService.delete(id, actor);
      if (result?.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'route not found' });
    return true;
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'internal server error' });
    return true;
  }
}
