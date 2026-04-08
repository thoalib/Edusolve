import { ALL_ROLES } from '../common/roles.js';
import { env } from '../config/env.js';
import { getSupabaseAdminClient, getSupabaseAuthClient } from '../config/supabase.js';

function roleFromUser(user) {
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  return ALL_ROLES.includes(role) ? role : null;
}

async function resolveRoleFromDb(userId) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient || !userId) return null;

  const { data, error } = await adminClient
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.roles) return null;
  const roleCode = Array.isArray(data.roles) ? data.roles[0]?.code : data.roles.code;
  return ALL_ROLES.includes(roleCode) ? roleCode : null;
}

async function resolveNameFromDb(userId) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient || !userId) return null;

  const { data, error } = await adminClient
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.full_name;
}

export class AuthService {
  async login(payload) {
    const { email, password, role } = payload;

    if (!email) {
      return { ok: false, error: 'email is required' };
    }

    const authClient = getSupabaseAuthClient();
    if (authClient) {
      if (!password) {
        return { ok: false, error: 'password is required' };
      }

      const { data, error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };

      const resolvedRole = roleFromUser(data.user) || (await resolveRoleFromDb(data.user?.id));
      if (!resolvedRole) {
        return { ok: false, error: 'user role is missing or invalid' };
      }

      const dbName = await resolveNameFromDb(data.user.id);

      return {
        ok: true,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: resolvedRole,
          name: dbName || data.user.user_metadata?.name || null
        }
      };
    }

    // Strict dev fallback only when explicitly enabled.
    if (!env.allowDevRoleLogin) {
      return { ok: false, error: 'auth provider is not configured' };
    }
    if (!role || !ALL_ROLES.includes(role)) {
      return { ok: false, error: 'role is required in development mode' };
    }

    const token = Buffer.from(JSON.stringify({ email, role })).toString('base64');
    return {
      ok: true,
      token,
      user: { id: 'dev-user', email, role }
    };
  }

  async me(accessToken) {
    if (!accessToken) return { ok: false, error: 'missing token' };

    // 1. Try student login token first (base64 JSON)
    try {
      const studentUser = await this.studentMe(accessToken);
      if (studentUser && studentUser.ok) return studentUser;
    } catch (e) {
      // Ignore student decoding errors and proceed to standard auth
    }

    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { data, error } = await adminClient.auth.getUser(accessToken);
      if (error || !data.user) return { ok: false, error: error?.message || 'invalid token' };

      const resolvedRole = roleFromUser(data.user) || (await resolveRoleFromDb(data.user.id));
      if (!resolvedRole) {
        return { ok: false, error: 'user role is missing or invalid' };
      }

      const dbName = await resolveNameFromDb(data.user.id);

      return {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: resolvedRole,
          name: dbName || data.user.user_metadata?.name || null
        }
      };
    }

    try {
      const parsed = JSON.parse(Buffer.from(accessToken, 'base64').toString('utf8'));
      if (!parsed?.email || !parsed?.role) return { ok: false, error: 'invalid token' };
      return {
        ok: true,
        user: { id: 'dev-user', email: parsed.email, role: parsed.role }
      };
    } catch {
      return { ok: false, error: 'invalid token' };
    }
  }
  async refresh(refreshToken) {
    if (!refreshToken) return { ok: false, error: 'missing refresh token' };

    const authClient = getSupabaseAuthClient();
    if (authClient) {
      const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
      if (error) return { ok: false, error: error.message };

      const resolvedRole = roleFromUser(data.user) || (await resolveRoleFromDb(data.user?.id));
      if (!resolvedRole) return { ok: false, error: 'user role is missing or invalid' };

      const dbName = await resolveNameFromDb(data.user.id);

      return {
        ok: true,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: resolvedRole,
          name: dbName || data.user.user_metadata?.name || null
        }
      };
    }

    return { ok: false, error: 'auth provider is not configured for refresh' };
  }

  async studentLogin(phone, pin) {
    if (!phone || !pin) return { ok: false, error: 'phone and pin are required' };

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 7) return { ok: false, error: 'invalid phone number' };
    if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'PIN must be exactly 6 digits' };

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { ok: false, error: 'database not configured' };

    // Search for a student by contact_number, alternative_number or parent_phone
    const { data: students, error } = await adminClient
      .from('students')
      .select('id, student_name, student_code, contact_number, login_pin, status, remaining_hours, total_hours, class_level, board, medium, country, academic_coordinator_id')
      .is('deleted_at', null)
      .ilike('contact_number', `%${cleanPhone}%`);

    if (error) return { ok: false, error: 'database error' };
    if (!students || students.length === 0) return { ok: false, error: 'No student found with this phone number' };

    // Find the one whose PIN matches
    const student = students.find(s => (s.login_pin || '123456') === pin);
    if (!student) return { ok: false, error: 'Incorrect PIN' };

    if (student.status === 'inactive') return { ok: false, error: 'This student account is inactive. Please contact your coordinator.' };

    // Generate a simple token (base64 JSON) containing student info
    const tokenPayload = { studentId: student.id, role: 'student', phone: cleanPhone };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return {
      ok: true,
      token,
      user: {
        id: student.id,
        name: student.student_name,
        role: 'student',
        studentCode: student.student_code
      }
    };
  }

  async studentMe(accessToken) {
    if (!accessToken) return { ok: false, error: 'missing token' };

    try {
      const parsed = JSON.parse(Buffer.from(accessToken, 'base64').toString('utf8'));
      if (parsed?.role !== 'student' || !parsed?.studentId) return null; // Not a student token

      const adminClient = getSupabaseAdminClient();
      if (!adminClient) return { ok: false, error: 'database not configured' };

      const { data: student, error } = await adminClient
        .from('students')
        .select('id, student_name, student_code, status')
        .eq('id', parsed.studentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !student) return { ok: false, error: 'student not found' };

      return {
        ok: true,
        user: {
          id: student.id,
          name: student.student_name,
          role: 'student',
          studentCode: student.student_code
        }
      };
    } catch {
      return null; // Not a student token, let normal flow handle
    }
  }
}
