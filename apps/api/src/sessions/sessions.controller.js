import { getSupabaseAdminClient } from '../config/supabase.js';
import { notifySessionRescheduled, notifyRescheduleAccepted } from '../common/n8n-webhook.js';
import { readJson, sendJson } from '../common/http.js';

const nowIso = () => new Date().toISOString();

function actorFromHeaders(req) {
  const rawRole = req.headers['x-user-role'];
  const rawId = req.headers['x-user-id'];
  return {
    role: typeof rawRole === 'string' ? rawRole : 'unknown',
    userId: typeof rawId === 'string' ? rawId : ''
  };
}

function canViewSessionPages(actor) {
  return ['academic_coordinator', 'finance', 'super_admin'].includes(actor.role);
}

function isAC(actor) {
  return actor.role === 'academic_coordinator';
}

function canVerifySessions(actor) {
  return actor.role === 'academic_coordinator';
}

function verificationStatusOf(session) {
  const row = Array.isArray(session.session_verifications) ? session.session_verifications[0] : session.session_verifications;
  return row?.status || 'pending';
}

export async function handleSessions(req, res, url) {
  if (!url.pathname.startsWith('/sessions') && !url.pathname.startsWith('/academic/sessions')) return false;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    sendJson(res, 500, { ok: false, error: 'supabase admin is not configured' });
    return true;
  }

  const actor = actorFromHeaders(req);

  try {
    async function fetchAllPaginated(buildQuery, maxLimit = 10000) {
      let allData = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          if (data.length < PAGE_SIZE || allData.length >= maxLimit) hasMore = false;
          page++;
        }
      }
      return { data: allData, error: null };
    }

    if (req.method === 'GET' && url.pathname === '/sessions/verification-queue') {
      if (!canViewSessionPages(actor)) {
        sendJson(res, 403, { ok: false, error: 'session queue access is not allowed for this role' });
        return true;
      }

      const buildQuery = () => {
        let query = adminClient
          .from('academic_sessions')
          .select('*, students(student_code,student_name,academic_coordinator_id), users!academic_sessions_teacher_id_fkey(id,full_name,email), session_verifications(id,type,status,reason,verified_at,new_date,new_time,new_duration,created_at)')
          .eq('status', 'completed')
          .order('session_date', { ascending: false });
        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        if (fromParam && toParam) {
          query = query.gte('session_date', fromParam.includes('T') ? fromParam.split('T')[0] : fromParam)
                       .lte('session_date', toParam.includes('T') ? toParam.split('T')[0] : toParam);
        }
        return query;
      };

      const { data, error } = await fetchAllPaginated(buildQuery);
      if (error) throw new Error(error.message);

      // Only show sessions with pending approval-type verification
      let pending = (data || []).filter((item) => {
        const sv = item.session_verifications;
        if (!sv) return false;
        if (Array.isArray(sv)) return sv.some(v => v.status === 'pending' && v.type === 'approval');
        return sv.status === 'pending' && sv.type === 'approval';
      });
      // Coordinator filtering: only show sessions for their assigned students
      const requestedUserId = url.searchParams.get('user_id');
      if (isAC(actor)) {
        pending = pending.filter(s => s.students?.academic_coordinator_id === actor.userId);
      } else if (actor.role === 'super_admin' && requestedUserId) {
        pending = pending.filter(s => s.students?.academic_coordinator_id === requestedUserId);
      }
      sendJson(res, 200, { ok: true, items: pending });
      return true;
    }

    // ── Reschedule Queue (pending reschedule requests) ──
    if (req.method === 'GET' && url.pathname === '/sessions/reschedule-queue') {
      if (!canViewSessionPages(actor)) {
        sendJson(res, 403, { ok: false, error: 'reschedule queue access is not allowed for this role' });
        return true;
      }

      const buildQuery = () => {
        let query = adminClient
          .from('session_verifications')
          .select('*, academic_sessions:session_id(*, students(student_code,student_name,academic_coordinator_id), users!academic_sessions_teacher_id_fkey(id,full_name,email))')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        if (fromParam && toParam) {
          query = query.gte('created_at', (fromParam.includes('T') ? fromParam.split('T')[0] : fromParam) + 'T00:00:00.000Z')
                       .lte('created_at', (toParam.includes('T') ? toParam.split('T')[0] : toParam) + 'T23:59:59.999Z');
        }
        return query;
      };

      const { data, error } = await fetchAllPaginated(buildQuery);
      if (error) throw new Error(error.message);

      let items = (data || []).filter(v => v.type === 'reschedule');
      // Coordinator filtering
      const requestedUserId = url.searchParams.get('user_id');
      if (isAC(actor)) {
        items = items.filter(v => v.academic_sessions?.students?.academic_coordinator_id === actor.userId);
      } else if (actor.role === 'super_admin' && requestedUserId) {
        items = items.filter(v => v.academic_sessions?.students?.academic_coordinator_id === requestedUserId);
      }
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    // ── Verification Logs (all verifications — audit log) ──
    if (req.method === 'GET' && url.pathname === '/sessions/verification-logs') {
      if (!canViewSessionPages(actor)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed' });
        return true;
      }

      const buildQuery = () => {
        let query = adminClient
          .from('session_verifications')
          .select('*, academic_sessions:session_id(id, session_date, started_at, duration_hours, subject, student_id, teacher_id, students(student_code, student_name, academic_coordinator_id), users!academic_sessions_teacher_id_fkey(full_name))')
          .order('created_at', { ascending: false });

        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        if (fromParam && toParam) {
          query = query.gte('created_at', (fromParam.includes('T') ? fromParam.split('T')[0] : fromParam) + 'T00:00:00.000Z')
                       .lte('created_at', (toParam.includes('T') ? toParam.split('T')[0] : toParam) + 'T23:59:59.999Z');
        }
        return query;
      };

      const { data, error } = await fetchAllPaginated(buildQuery);
      if (error) throw new Error(error.message);

      let items = data || [];

      // Coordinator: only show their students
      if (isAC(actor)) {
        items = items.filter(v => v.academic_sessions?.students?.academic_coordinator_id === actor.userId);
      }

      sendJson(res, 200, { ok: true, items });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/sessions/logs') {
      if (!canViewSessionPages(actor)) {
        sendJson(res, 403, { ok: false, error: 'session log access is not allowed for this role' });
        return true;
      }

      const buildQuery = () => adminClient
        .from('academic_sessions')
        .select('*, students(student_code,student_name), users!academic_sessions_teacher_id_fkey(id,full_name,email), session_verifications(status,reason,verified_at,new_duration)')
        .eq('status', 'completed')
        .order('session_date', { ascending: false });

      const { data, error } = await fetchAllPaginated(buildQuery);
      if (error) throw new Error(error.message);

      let items = (data || []).map((item) => ({
        ...item,
        verification_status: verificationStatusOf(item)
      }));

      items = items.filter(i => i.verification_status === 'approved');
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/sessions/all') {
      if (!canViewSessionPages(actor)) {
        sendJson(res, 403, { ok: false, error: 'session list access is not allowed for this role' });
        return true;
      }

      const qs = url.searchParams;
      const startDate = qs.get('start_date');
      const endDate = qs.get('end_date');
      const teacherId = qs.get('teacher_id');
      const studentId = qs.get('student_id');
      const statusStr = qs.get('status');

      let query = adminClient
        .from('academic_sessions')
        .select('*, students!inner(student_code,student_name,academic_coordinator_id), users!academic_sessions_teacher_id_fkey(id,full_name,email), session_verifications(status,reason,verified_at,new_duration)');

      if (startDate) query = query.gte('session_date', startDate);
      if (endDate) query = query.lte('session_date', endDate);
      if (teacherId) query = query.eq('teacher_id', teacherId);
      if (studentId) query = query.eq('student_id', studentId);
      const virtualStatuses = ['pending', 'verified', 'not_verified'];
      if (statusStr && !virtualStatuses.includes(statusStr)) {
        query = query.eq('status', statusStr);
      } else if (statusStr === 'verified' || statusStr === 'not_verified') {
        query = query.eq('status', 'completed');
      }


      const buildQuery = () => {
        let q = query.order('session_date', { ascending: false });
        const requestedUserId = url.searchParams.get('user_id');
        
        if (isAC(actor)) {
          q = q.eq('students.academic_coordinator_id', actor.userId);
        } else if (actor.role === 'super_admin' && requestedUserId) {
          q = q.eq('students.academic_coordinator_id', requestedUserId);
        }
        return q;
      };

      const { data, error } = await fetchAllPaginated(buildQuery);

      if (error) throw new Error(error.message);

      let items = (data || []).map((item) => ({
        ...item,
        verification_status: verificationStatusOf(item)
      }));

      // In app/db, academic_sessions status is historically 'upcoming', 'scheduled', 'completed' etc. 
      // User asked for "pending" status, which usually means scheduled but not taken, or taken but not verified.
      // We will map 'scheduled' to 'upcoming' if it's future, or leave it as is, and filter by pending verification if statusStr === 'pending'
      if (statusStr === 'pending') {
        items = items.filter(i => i.verification_status === 'pending');
      } else if (statusStr === 'verified') {
        items = items.filter(i => i.verification_status === 'approved');
      } else if (statusStr === 'not_verified') {
        items = items.filter(i => i.verification_status !== 'approved');
      }


      sendJson(res, 200, { ok: true, items });
      return true;
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'PUT' && parts.length === 3 && parts[0] === 'sessions' && parts[2] === 'reschedule') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed to reschedule' });
        return true;
      }
      const sessionId = parts[1];
      const payload = await readJson(req);
      const { session_date, started_at, duration_hours } = payload;
      if (!session_date || !started_at || !duration_hours) {
        sendJson(res, 400, { ok: false, error: 'Missing required rescheduling fields' });
        return true;
      }

      // Fetch old session BEFORE update (for webhook old/new comparison)
      const { data: oldSession } = await adminClient
        .from('academic_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      const { data, error } = await adminClient
        .from('academic_sessions')
        .update({
          session_date,
          started_at: started_at.includes('T') ? started_at : `${session_date}T${started_at}:00+05:30`,
          duration_hours: Number(duration_hours),
          status: 'rescheduled',
          ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
          ...(payload.teacher_id ? { teacher_id: payload.teacher_id } : {}),
          updated_at: nowIso()
        })
        .eq('id', sessionId)
        .select('*');

      if (error) throw new Error(error.message);

      // ── n8n Webhook: notify reschedule with old + new details (fire-and-forget) ──
      if (oldSession) {
        notifySessionRescheduled(oldSession, {
          session_date,
          started_at: started_at.includes('T') ? started_at : `${session_date}T${started_at}:00+05:30`,
          duration_hours: Number(duration_hours),
          subject: payload.subject,
          teacher_id: payload.teacher_id
        }, {
          rescheduledBy: actor.userId
        }).catch(err => console.error('[n8n-webhook] reschedule notify error:', err.message));
      }

      sendJson(res, 200, { ok: true, session: data });
      return true;
    }

    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'sessions' && parts[2] === 'verify') {
      if (!canVerifySessions(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can verify sessions' });
        return true;
      }

      const sessionId = parts[1];
      const payload = await readJson(req);
      const approved = payload.approved !== false;
      const verifyType = payload.type || 'approval'; // 'approval' or 'reschedule'

      const { data: session, error: sessionError } = await adminClient
        .from('academic_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      if (!session) {
        sendJson(res, 404, { ok: false, error: 'session not found' });
        return true;
      }

      const { data: existing, error: existingError } = await adminClient
        .from('session_verifications')
        .select('*')
        .eq('session_id', sessionId)
        .eq('type', verifyType)
        .eq('status', 'pending')
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (!existing) {
        sendJson(res, 400, { ok: false, error: 'no pending request found for this session' });
        return true;
      }

      const status = approved ? 'approved' : 'rejected';

      const { error: updateError } = await adminClient
        .from('session_verifications')
        .update({
          verifier_id: actor.userId,
          status,
          reason: payload.reason || existing.reason,
          verified_at: nowIso()
        })
        .eq('id', existing.id);
      if (updateError) throw new Error(updateError.message);

      // Handle approval-type verification
      if (verifyType === 'approval') {
        const newSessionStatus = approved ? 'completed' : 'scheduled';

        let sessionUpdate = { status: newSessionStatus, updated_at: nowIso() };
        let duration = Number(session.duration_hours || 0);
        if (payload.override_duration) {
            duration = Number(payload.override_duration);
        } else if (existing.new_duration !== null && existing.new_duration !== undefined) {
            duration = Number(existing.new_duration);
        }

        const { error: sessUpdateErr } = await adminClient.from('academic_sessions').update(sessionUpdate).eq('id', sessionId);
        if (sessUpdateErr) throw new Error(sessUpdateErr.message);

        if (approved) {
          if (duration > 0) {
            const { data: student, error: studentError } = await adminClient
              .from('students')
              .select('id, remaining_hours')
              .eq('id', session.student_id)
              .maybeSingle();
            if (studentError) throw new Error(studentError.message);
            if (student) {
              const remaining = Number(student.remaining_hours || 0) - duration;
              const { error: studentUpdateError } = await adminClient
                .from('students')
                .update({ remaining_hours: remaining, updated_at: nowIso() })
                .eq('id', student.id);
              if (studentUpdateError) throw new Error(studentUpdateError.message);
            }

            await adminClient.from('hour_ledger').insert([
              {
                student_id: session.student_id,
                teacher_id: session.teacher_id,
                session_id: session.id,
                hours_delta: -duration,
                entry_type: 'student_debit',
                created_at: nowIso()
              },
              {
                student_id: session.student_id,
                teacher_id: session.teacher_id,
                session_id: session.id,
                hours_delta: duration,
                entry_type: 'teacher_credit',
                created_at: nowIso()
              }
            ]);
          }
        }
      }

      // Handle reschedule-type verification
      if (verifyType === 'reschedule') {
        if (approved) {
          const updates = { status: 'rescheduled' };

          let targetDate = existing.new_date || session.session_date;

          if (existing.new_date) updates.session_date = existing.new_date;

          if (existing.new_time) {
            // Must convert to proper Postgres ISO timestamp using the requested date and time
            try {
              const dt = new Date(`${targetDate}T${existing.new_time}:00+05:30`);
              if (!isNaN(dt.getTime())) {
                updates.started_at = dt.toISOString();
              }
            } catch (err) {
              console.error("Time Parse Error:", err);
            }
          }

          // To support new_duration, check if it's available in the payload or via the DB row
          if (existing.new_duration) {
            updates.duration_hours = Number(existing.new_duration);
          } else if (payload.new_duration) {
            updates.duration_hours = Number(payload.new_duration);
          }

          await adminClient.from('academic_sessions').update(updates).eq('id', sessionId);

          // ── n8n Webhook: notify reschedule accepted with old + new (fire-and-forget) ──
          notifyRescheduleAccepted(session, existing, {
            approvedBy: actor.userId
          }).catch(err => console.error('[n8n-webhook] reschedule accepted notify error:', err.message));
        }
        // If rejected, no change to session
      }

      sendJson(res, 200, { ok: true, status });
      return true;
    }


    // ── Edit session (AC / super_admin) ──
    if (req.method === 'PATCH' && parts.length === 2 && parts[0] === 'sessions') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed to edit sessions' });
        return true;
      }
      const sessionId = parts[1];
      const payload = await readJson(req);
      const allowed = ['subject', 'session_date', 'started_at', 'duration_hours', 'status', 'teacher_id'];
      const patch = {};
      for (const key of allowed) {
        if (payload[key] !== undefined) patch[key] = payload[key];
      }
      if (patch.session_date && patch.started_at && !patch.started_at.includes('T')) {
        patch.started_at = `${patch.session_date}T${patch.started_at}:00+05:30`;
      }
      patch.updated_at = nowIso();

      const { data: existingSession, error: sessErr } = await adminClient.from('academic_sessions').select('*').eq('id', sessionId).single();
      if (!existingSession) throw new Error("session not found");

      let refundHours = 0;
      if (existingSession.status === 'completed') {
        const oldDuration = Number(existingSession.duration_hours || 0);
        let newDuration = oldDuration;
        
        if (patch.duration_hours !== undefined) newDuration = Number(patch.duration_hours);
        
        if (patch.status && patch.status !== 'completed') {
           refundHours = oldDuration; 
        } else if (newDuration !== oldDuration) {
           refundHours = oldDuration - newDuration;
        }
      }

      const { data, error } = await adminClient
        .from('academic_sessions')
        .update(patch)
        .eq('id', sessionId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      if (refundHours !== 0 && existingSession.student_id) {
         const { data: student } = await adminClient.from('students').select('remaining_hours').eq('id', existingSession.student_id).single();
         if (student) {
             const newRemaining = Number(student.remaining_hours || 0) + refundHours;
             await adminClient.from('students').update({ remaining_hours: newRemaining, updated_at: nowIso() }).eq('id', existingSession.student_id);

             await adminClient.from('hour_ledger').insert({
                student_id: existingSession.student_id,
                session_id: sessionId,
                hours_delta: refundHours,
                entry_type: refundHours > 0 ? 'student_credit' : 'student_debit',
                notes: `Session Edit Adjustment (SID: ${sessionId})`,
                created_at: nowIso()
             });
         }
      }

      sendJson(res, 200, { ok: true, session: data });
      return true;
    }

    // ── Delete session (AC / super_admin) ──
    if (req.method === 'PUT' && url.pathname === '/sessions/edit-verification') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed to edit verifications' });
        return true;
      }
      const payload = await readJson(req);
      if (!payload || !payload.verification_id || typeof payload.new_duration !== 'number') {
        sendJson(res, 400, { ok: false, error: 'invalid payload' });
        return true;
      }

      const { data: vRecord, error: vErr } = await adminClient
        .from('session_verifications')
        .select('*, academic_sessions:session_id(*)')
        .eq('id', payload.verification_id)
        .single();
      if (vErr || !vRecord) throw new Error(vErr?.message || 'verification record not found');

      const session = vRecord.academic_sessions;
      if (!session) throw new Error('academic session not found');
      if (vRecord.status !== 'approved') {
        throw new Error('can only edit approved verifications');
      }

      const newDur = payload.new_duration;
      const oldDur = vRecord.new_duration !== null && vRecord.new_duration !== undefined ? Number(vRecord.new_duration) : Number(session.duration_hours);
      const delta = newDur - oldDur;

      if (delta !== 0) {
        const { error: svError } = await adminClient.from('session_verifications').update({ new_duration: newDur }).eq('id', payload.verification_id);
        if (svError) throw new Error(`Failed to update verification: ${svError.message}`);

        const { error: hlError } = await adminClient.from('hour_ledger').insert([
          {
            student_id: session.student_id,
            teacher_id: session.teacher_id,
            session_id: session.id,
            hours_delta: -delta,
            entry_type: 'student_debit',
            notes: `Correction from ${oldDur}h to ${newDur}h`,
            created_at: nowIso()
          },
          {
            student_id: session.student_id,
            teacher_id: session.teacher_id,
            session_id: session.id,
            hours_delta: delta,
            entry_type: 'teacher_credit',
            notes: `Correction from ${oldDur}h to ${newDur}h`,
            created_at: nowIso()
          }
        ]);
        if (hlError) throw new Error(`Failed to update ledger: ${hlError.message}`);

        const { data: student } = await adminClient.from('students').select('id, remaining_hours').eq('id', session.student_id).maybeSingle();
        if (student) {
          const remaining = Number(student.remaining_hours || 0) - delta;
          await adminClient.from('students').update({ remaining_hours: remaining, updated_at: nowIso() }).eq('id', student.id);
        }
      }

      sendJson(res, 200, { ok: true });
      return true;
    }

    // ── POST /academic/sessions/:id/force-complete ──
    if (req.method === 'POST' && parts.length === 4 && parts[0] === 'academic' && parts[1] === 'sessions' && parts[3] === 'force-complete') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed to force complete sessions' });
        return true;
      }
      const sessionId = parts[2];
      const rawBody = await readJson(req);
      const actualHours = Number(rawBody.actual_hours);
      
      if (isNaN(actualHours) || actualHours <= 0) {
        sendJson(res, 400, { ok: false, error: 'Invalid actual_hours' });
        return true;
      }

      const { data: session } = await adminClient.from('academic_sessions').select('*').eq('id', sessionId).single();
      if (!session) {
        sendJson(res, 404, { ok: false, error: 'Session not found' });
        return true;
      }
      if (session.status === 'completed') {
        sendJson(res, 400, { ok: false, error: 'Session is already completed' });
        return true;
      }
      
      // Update session status
      const { error: updateErr } = await adminClient.from('academic_sessions').update({ status: 'completed' }).eq('id', sessionId);
      if (updateErr) throw new Error('Failed to update session: ' + updateErr.message);

      // Delete any pending verifications
      await adminClient.from('session_verifications').delete().eq('session_id', sessionId).neq('status', 'approved');

      // Insert approved verification
      const { error: vErr } = await adminClient.from('session_verifications').insert({
        session_id: sessionId,
        verifier_id: actor.userId,
        status: 'approved',
        type: 'approval',
        reason: 'Force completed by ' + actor.role,
        new_duration: actualHours,
        verified_at: nowIso()
      });
      if (vErr) throw new Error('Failed to create verification: ' + vErr.message);

      // Update student hours
      if (session.student_id) {
        const { data: student } = await adminClient.from('students').select('id, remaining_hours').eq('id', session.student_id).maybeSingle();
        if (student) {
          const remaining = Number(student.remaining_hours || 0) - actualHours;
          await adminClient.from('students').update({ remaining_hours: remaining, updated_at: nowIso() }).eq('id', session.student_id);

          await adminClient.from('hour_ledger').insert([
            {
              student_id: session.student_id,
              teacher_id: session.teacher_id,
              session_id: session.id,
              hours_delta: -actualHours,
              entry_type: 'student_debit',
              created_at: nowIso()
            },
            {
              student_id: session.student_id,
              teacher_id: session.teacher_id,
              session_id: session.id,
              hours_delta: actualHours,
              entry_type: 'teacher_credit',
              created_at: nowIso()
            }
          ]);
        }
      }

      sendJson(res, 200, { ok: true, message: 'Session force completed' });
      return true;
    }

    if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'sessions') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'Not allowed to delete sessions' });
        return true;
      }
      const sessionId = parts[1];
      
      const { data: existingSession } = await adminClient.from('academic_sessions').select('*').eq('id', sessionId).single();
      
      if (existingSession && existingSession.status === 'completed' && existingSession.student_id) {
         const refundHours = Number(existingSession.duration_hours || 0);
         if (refundHours > 0) {
             const { data: student } = await adminClient.from('students').select('remaining_hours').eq('id', existingSession.student_id).single();
             if (student) {
                 const newRemaining = Number(student.remaining_hours || 0) + refundHours;
                 await adminClient.from('students').update({ remaining_hours: newRemaining, updated_at: nowIso() }).eq('id', existingSession.student_id);

                 await adminClient.from('hour_ledger').insert({
                    student_id: existingSession.student_id,
                    hours_delta: refundHours,
                    entry_type: 'student_credit',
                    notes: `Session Deleted Refund (SID: ${sessionId})`,
                    created_at: nowIso()
                 });
             }
         }
      }

      const { error } = await adminClient
        .from('academic_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'PUT' && parts.length === 3 && parts[0] === 'sessions' && parts[1] === 'ledger') {
      if (actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'Only super_admin can edit ledger entries' });
        return true;
      }
      
      const payload = await readJson(req);
      if (!payload || typeof payload.new_hours_delta !== 'number') {
        sendJson(res, 400, { ok: false, error: 'invalid payload' });
        return true;
      }

      const ledgerId = parts[2];
      const { data: ledgerEntry, error: ledgerError } = await adminClient.from('hour_ledger').select('*').eq('id', ledgerId).single();
      if (ledgerError || !ledgerEntry) {
        sendJson(res, 404, { ok: false, error: 'Ledger entry not found' });
        return true;
      }

      const oldDelta = Number(ledgerEntry.hours_delta || 0);
      const newDelta = Number(payload.new_hours_delta);
      const difference = newDelta - oldDelta;

      if (difference !== 0) {
        // Adjust the student's remaining hours
        // Example: old = -1.5, new = -2.0. Difference = -0.5.
        // We add difference to remaining_hours. (remaining + (-0.5) = remaining - 0.5).
        if (ledgerEntry.student_id) {
          const { data: student } = await adminClient.from('students').select('id, remaining_hours').eq('id', ledgerEntry.student_id).single();
          if (student) {
            const newRemaining = Number(student.remaining_hours || 0) + difference;
            await adminClient.from('students').update({ remaining_hours: newRemaining, updated_at: nowIso() }).eq('id', student.id);
          }
        }

        const { error: updateError } = await adminClient.from('hour_ledger').update({ hours_delta: newDelta }).eq('id', ledgerId);
        if (updateError) throw new Error(updateError.message);
      }

      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'DELETE' && parts.length === 3 && parts[0] === 'sessions' && parts[1] === 'ledger') {
      if (actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'Only super_admin can delete ledger entries' });
        return true;
      }
      
      const ledgerId = parts[2];
      const { data: ledgerEntry, error: ledgerError } = await adminClient.from('hour_ledger').select('*').eq('id', ledgerId).single();
      if (ledgerError || !ledgerEntry) {
        sendJson(res, 404, { ok: false, error: 'Ledger entry not found' });
        return true;
      }

      // Restore the student's remaining hours
      // If we are deleting a deduction (hours_delta < 0), we ADD it back to remaining_hours (remaining - delta)
      // If we are deleting an addition (hours_delta > 0), we SUBTRACT it from remaining_hours (remaining - delta)
      if (ledgerEntry.student_id && ledgerEntry.hours_delta) {
        const { data: student } = await adminClient.from('students').select('id, remaining_hours').eq('id', ledgerEntry.student_id).single();
        if (student) {
          const newRemaining = Number(student.remaining_hours || 0) - Number(ledgerEntry.hours_delta);
          await adminClient.from('students').update({ remaining_hours: newRemaining, updated_at: nowIso() }).eq('id', student.id);
        }
      }

      const { error: delError } = await adminClient.from('hour_ledger').delete().eq('id', ledgerId);
      if (delError) throw new Error(delError.message);

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
