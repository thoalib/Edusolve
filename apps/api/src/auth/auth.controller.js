import { getBearerToken, readJson, sendJson } from '../common/http.js';
import { AuthService } from './auth.service.js';

const authService = new AuthService();

export async function handleAuth(req, res) {
  if (req.method === 'POST' && req.url === '/auth/login') {
    try {
      const payload = await readJson(req);
      const result = await authService.login(payload);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === 'POST' && req.url === '/auth/student-login') {
    try {
      const payload = await readJson(req);
      const result = await authService.studentLogin(payload.phone, payload.pin);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === 'GET' && req.url === '/auth/me') {
    const token = getBearerToken(req);

    // Try student token first (base64 JSON with role=student)
    const studentResult = await authService.studentMe(token);
    if (studentResult) {
      sendJson(res, studentResult.ok ? 200 : 401, studentResult);
      return true;
    }

    const result = await authService.me(token);
    sendJson(res, result.ok ? 200 : 401, result);
    return true;
  }

  if (req.method === 'POST' && req.url === '/auth/refresh') {
    try {
      const payload = await readJson(req);
      const result = await authService.refresh(payload.refreshToken);
      sendJson(res, result.ok ? 200 : 401, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  return false;
}
