/**
 * n8n Webhook Integration Service
 * 
 * Sends session event payloads to n8n webhook for automation triggers.
 * Events:
 *   - session_scheduled_today: When a session is bulk-scheduled for today (after 7 AM IST)
 *   - session_rescheduled: When a session is directly rescheduled (by AC)
 *   - reschedule_accepted: When a reschedule request is approved
 */

const N8N_WEBHOOK_URL = process.env.N8N_SESSION_WEBHOOK_URL || '';

/**
 * Get current IST date string (YYYY-MM-DD) and hour
 */
function getISTNow() {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istStr);
  const pad = n => String(n).padStart(2, '0');
  return {
    dateStr: `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())}`,
    hour: istDate.getHours(),
    minute: istDate.getMinutes()
  };
}

/**
 * Fire-and-forget POST to the n8n webhook.
 * Logs errors but never throws — should not block API responses.
 */
async function sendToN8N(payload) {
  if (!N8N_WEBHOOK_URL) {
    console.log('[n8n-webhook] N8N_SESSION_WEBHOOK_URL not set, skipping webhook');
    return;
  }

  try {
    console.log(`[n8n-webhook] Sending event: ${payload.event}`);
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[n8n-webhook] n8n responded ${res.status}: ${errText}`);
    } else {
      console.log(`[n8n-webhook] Successfully sent event: ${payload.event}`);
    }
  } catch (err) {
    console.error(`[n8n-webhook] Failed to send webhook:`, err.message);
  }
}

/**
 * Notify n8n about sessions that were bulk-scheduled for TODAY.
 * Only fires if current IST time is 7:00 AM or later.
 * 
 * @param {Array} createdSessions - Array of session records that were just inserted
 * @param {object} context - { studentId, teacherId, subject }
 */
export async function notifyBulkScheduledToday(createdSessions, context) {
  const ist = getISTNow();

  // Only send if it's 7 AM or later
  if (ist.hour < 7) {
    console.log('[n8n-webhook] Skipping bulk notification — before 7 AM IST');
    return;
  }

  // Filter only sessions that are for today
  const todaySessions = createdSessions.filter(s => s.session_date === ist.dateStr);

  if (todaySessions.length === 0) {
    console.log('[n8n-webhook] No same-day sessions in bulk schedule, skipping');
    return;
  }

  await sendToN8N({
    event: 'session_scheduled_today',
    timestamp: new Date().toISOString(),
    student_id: context.studentId,
    teacher_id: context.teacherId,
    subject: context.subject || null,
    scheduled_by: context.scheduledBy || null,
    sessions: todaySessions.map(s => ({
      id: s.id,
      session_date: s.session_date,
      started_at: s.started_at,
      duration_hours: s.duration_hours,
      subject: s.subject,
      status: s.status
    }))
  });
}

/**
 * Notify n8n about a direct reschedule (AC directly reschedules a session).
 * Sends both old and new session details.
 * 
 * @param {object} oldSession - The session record BEFORE reschedule
 * @param {object} newData - The new date/time/duration fields
 * @param {object} context - { rescheduledBy }
 */
export async function notifySessionRescheduled(oldSession, newData, context) {
  await sendToN8N({
    event: 'session_rescheduled',
    timestamp: new Date().toISOString(),
    session_id: oldSession.id,
    student_id: oldSession.student_id,
    teacher_id: newData.teacher_id || oldSession.teacher_id,
    subject: newData.subject || oldSession.subject,
    rescheduled_by: context.rescheduledBy || null,
    old_schedule: {
      session_date: oldSession.session_date,
      started_at: oldSession.started_at,
      duration_hours: oldSession.duration_hours
    },
    new_schedule: {
      session_date: newData.session_date || oldSession.session_date,
      started_at: newData.started_at || oldSession.started_at,
      duration_hours: newData.duration_hours || oldSession.duration_hours
    }
  });
}

/**
 * Notify n8n when a reschedule request is ACCEPTED/APPROVED.
 * Sends both old and new session details.
 * 
 * @param {object} oldSession - The original session record
 * @param {object} rescheduleRequest - The session_verifications row with new_date, new_time, new_duration
 * @param {object} context - { approvedBy }
 */
export async function notifyRescheduleAccepted(oldSession, rescheduleRequest, context) {
  await sendToN8N({
    event: 'reschedule_accepted',
    timestamp: new Date().toISOString(),
    session_id: oldSession.id,
    student_id: oldSession.student_id,
    teacher_id: oldSession.teacher_id,
    subject: oldSession.subject,
    approved_by: context.approvedBy || null,
    old_schedule: {
      session_date: oldSession.session_date,
      started_at: oldSession.started_at,
      duration_hours: oldSession.duration_hours
    },
    new_schedule: {
      session_date: rescheduleRequest.new_date || oldSession.session_date,
      started_at: rescheduleRequest.new_time || oldSession.started_at,
      duration_hours: rescheduleRequest.new_duration || oldSession.duration_hours
    }
  });
}
