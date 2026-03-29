import { getSupabaseAdminClient } from '../config/supabase.js';
import { readJson, sendJson } from '../common/http.js';

const ALLOWED_ROLES = ['teacher_coordinator', 'super_admin', 'hr', 'finance', 'academic_coordinator', 'teacher', 'counselor', 'counselor_head'];

function actorFromHeaders(req) {
    const rawRole = req.headers['x-user-role'];
    return typeof rawRole === 'string' ? rawRole : 'unknown';
}

export async function handleSubjectsBoards(req, res, url) {
    if (!url.pathname.startsWith('/subjects') && !url.pathname.startsWith('/boards') && !url.pathname.startsWith('/mediums') && !url.pathname.startsWith('/classes') && !url.pathname.startsWith('/experience-categories')) return false;

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) { sendJson(res, 500, { ok: false, error: 'supabase not configured' }); return true; }

    const role = actorFromHeaders(req);
    
    // Only allow GET for all roles (including teacher)
    // POST/PATCH/DELETE restricted to coordinators/admins
    const isWrite = req.method !== 'GET';
    const writeRoles = ['teacher_coordinator', 'super_admin', 'hr', 'finance', 'academic_coordinator'];
    
    if (isWrite && !writeRoles.includes(role)) {
        sendJson(res, 403, { ok: false, error: 'insufficient role for modifications' });
        return true;
    }

    if (!ALLOWED_ROLES.includes(role)) { 
        sendJson(res, 403, { ok: false, error: 'insufficient role' }); 
        return true; 
    }

    // ─── SUBJECTS ───
    if (url.pathname === '/subjects' || url.pathname.startsWith('/subjects/')) {
        const idMatch = url.pathname.match(/^\/subjects\/([^/]+)$/);

        // GET /subjects
        if (req.method === 'GET' && url.pathname === '/subjects') {
            const { data, error } = await adminClient.from('subjects').select('*').order('name');
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, subjects: data });
            return true;
        }

        // POST /subjects
        if (req.method === 'POST' && url.pathname === '/subjects') {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('subjects').insert({ name: body.name.trim() }).select().single();
            if (error) {
                if (error.code === '23505') { sendJson(res, 409, { ok: false, error: 'Subject already exists' }); return true; }
                sendJson(res, 500, { ok: false, error: error.message }); return true;
            }
            sendJson(res, 201, { ok: true, subject: data });
            return true;
        }

        // PATCH /subjects/:id
        if (req.method === 'PATCH' && idMatch) {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('subjects').update({ name: body.name.trim() }).eq('id', idMatch[1]).select().single();
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, subject: data });
            return true;
        }

        // DELETE /subjects/:id
        if (req.method === 'DELETE' && idMatch) {
            const { error } = await adminClient.from('subjects').delete().eq('id', idMatch[1]);
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true });
            return true;
        }
    }

    // ─── BOARDS ───
    if (url.pathname === '/boards' || url.pathname.startsWith('/boards/')) {
        const idMatch = url.pathname.match(/^\/boards\/([^/]+)$/);

        // GET /boards
        if (req.method === 'GET' && url.pathname === '/boards') {
            const { data, error } = await adminClient.from('boards').select('*').order('name');
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, boards: data });
            return true;
        }

        // POST /boards
        if (req.method === 'POST' && url.pathname === '/boards') {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('boards').insert({ name: body.name.trim() }).select().single();
            if (error) {
                if (error.code === '23505') { sendJson(res, 409, { ok: false, error: 'Board already exists' }); return true; }
                sendJson(res, 500, { ok: false, error: error.message }); return true;
            }
            sendJson(res, 201, { ok: true, board: data });
            return true;
        }

        // PATCH /boards/:id
        if (req.method === 'PATCH' && idMatch) {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('boards').update({ name: body.name.trim() }).eq('id', idMatch[1]).select().single();
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, board: data });
            return true;
        }

        // DELETE /boards/:id
        if (req.method === 'DELETE' && idMatch) {
            const { error } = await adminClient.from('boards').delete().eq('id', idMatch[1]);
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true });
            return true;
        }
    }

    // ─── MEDIUMS ───
    if (url.pathname === '/mediums' || url.pathname.startsWith('/mediums/')) {
        const idMatch = url.pathname.match(/^\/mediums\/([^/]+)$/);

        // GET /mediums
        if (req.method === 'GET' && url.pathname === '/mediums') {
            const { data, error } = await adminClient.from('mediums').select('*').order('name');
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, mediums: data });
            return true;
        }

        // POST /mediums
        if (req.method === 'POST' && url.pathname === '/mediums') {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('mediums').insert({ name: body.name.trim() }).select().single();
            if (error) {
                if (error.code === '23505') { sendJson(res, 409, { ok: false, error: 'Medium already exists' }); return true; }
                sendJson(res, 500, { ok: false, error: error.message }); return true;
            }
            sendJson(res, 201, { ok: true, medium: data });
            return true;
        }

        // PATCH /mediums/:id
        if (req.method === 'PATCH' && idMatch) {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('mediums').update({ name: body.name.trim() }).eq('id', idMatch[1]).select().single();
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, medium: data });
            return true;
        }

        // DELETE /mediums/:id
        if (req.method === 'DELETE' && idMatch) {
            const { error } = await adminClient.from('mediums').delete().eq('id', idMatch[1]);
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true });
            return true;
        }
    }

    // ─── CLASSES ───
    if (url.pathname === '/classes' || url.pathname.startsWith('/classes/')) {
        const idMatch = url.pathname.match(/^\/classes\/([^/]+)$/);

        // GET /classes
        if (req.method === 'GET' && url.pathname === '/classes') {
            const { data, error } = await adminClient.from('classes').select('*').order('name');
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, classes: data });
            return true;
        }

        // POST /classes
        if (req.method === 'POST' && url.pathname === '/classes') {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('classes').insert({ name: body.name.trim() }).select().single();
            if (error) {
                if (error.code === '23505') { sendJson(res, 409, { ok: false, error: 'Class already exists' }); return true; }
                sendJson(res, 500, { ok: false, error: error.message }); return true;
            }
            sendJson(res, 201, { ok: true, class: data });
            return true;
        }

        // PATCH /classes/:id
        if (req.method === 'PATCH' && idMatch) {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('classes').update({ name: body.name.trim() }).eq('id', idMatch[1]).select().single();
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, class: data });
            return true;
        }

        // DELETE /classes/:id
        if (req.method === 'DELETE' && idMatch) {
            const { error } = await adminClient.from('classes').delete().eq('id', idMatch[1]);
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true });
            return true;
        }
    }

    // ─── EXPERIENCE CATEGORIES ───
    if (url.pathname === '/experience-categories' || url.pathname.startsWith('/experience-categories/')) {
        const idMatch = url.pathname.match(/^\/experience-categories\/([^/]+)$/);

        // GET /experience-categories
        if (req.method === 'GET' && url.pathname === '/experience-categories') {
            const { data, error } = await adminClient.from('experience_categories').select('*').order('name');
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, categories: data });
            return true;
        }

        // POST /experience-categories
        if (req.method === 'POST' && url.pathname === '/experience-categories') {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('experience_categories').insert({ name: body.name.trim() }).select().single();
            if (error) {
                if (error.code === '23505') { sendJson(res, 409, { ok: false, error: 'Category already exists' }); return true; }
                sendJson(res, 500, { ok: false, error: error.message }); return true;
            }
            sendJson(res, 201, { ok: true, category: data });
            return true;
        }

        // PATCH /experience-categories/:id
        if (req.method === 'PATCH' && idMatch) {
            const body = await readJson(req);
            if (!body.name?.trim()) { sendJson(res, 400, { ok: false, error: 'name is required' }); return true; }
            const { data, error } = await adminClient.from('experience_categories').update({ name: body.name.trim() }).eq('id', idMatch[1]).select().single();
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true, category: data });
            return true;
        }

        // DELETE /experience-categories/:id
        if (req.method === 'DELETE' && idMatch) {
            const { error } = await adminClient.from('experience_categories').delete().eq('id', idMatch[1]);
            if (error) { sendJson(res, 500, { ok: false, error: error.message }); return true; }
            sendJson(res, 200, { ok: true });
            return true;
        }
    }

    return false;
}
