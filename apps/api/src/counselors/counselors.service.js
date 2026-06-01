
import { getSupabaseAdminClient } from '../config/supabase.js';
import { randomUUID } from 'crypto';

export class CounselorsService {
    constructor() {
        this.admin = getSupabaseAdminClient();
    }

    // List all counselors with their profiles using the admin client
    async list() {
        if (!this.admin) return { error: 'Admin client not available' };

        // 1. Get role IDs for 'counselor' and 'counselor_head'
        const { data: rolesData, error: rolesError } = await this.admin
            .from('roles')
            .select('id')
            .in('code', ['counselor', 'counselor_head']);

        if (rolesError || !rolesData?.length) return { error: 'Counselor roles not found' };
        const roleIds = rolesData.map(r => r.id);

        // 2. Get users who have these roles
        const { data: userRoles, error: urError } = await this.admin
            .from('user_roles')
            .select('user_id')
            .in('role_id', roleIds);

        if (urError) return { error: urError.message };

        const userIds = userRoles.map(ur => ur.user_id);

        if (userIds.length === 0) return [];

        // 3. Get user profiles
        const { data: users, error: userError } = await this.admin
            .from('users')
            .select('*')
            .in('id', userIds)
            .order('full_name');

        if (userError) return { error: userError.message };

        // 4. Enrich with stats (optional, could be separate query for performance)
        // For now, just return profiles.
        return users;
    }

    // Create a new counselor
    async create(payload) {
        if (!this.admin) return { error: 'Admin client not available' };
        const { email, password, full_name, phone } = payload;

        // 1. Create Auth User
        const { data: authData, error: authError } = await this.admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, role: 'counselor', phone },
            app_metadata: { role: 'counselor' }
        });

        if (authError) return { error: authError.message };
        const user = authData.user;

        // 2. Create Profile in 'users' table
        const { error: profileError } = await this.admin
            .from('users')
            .insert({
                id: user.id,
                email: user.email,
                phone: phone,
                full_name: full_name || email.split('@')[0],
                is_active: true
            });

        if (profileError) {
            // Cleanup auth user if profile fails? 
            // ideally transaction, but for now just error out
            return { error: 'Failed to create profile: ' + profileError.message };
        }

        // 3. Assign Role in 'user_roles'
        const { data: roleData } = await this.admin.from('roles').select('id').eq('code', 'counselor').single();
        if (roleData) {
            await this.admin.from('user_roles').insert({ user_id: user.id, role_id: roleData.id });
        }

        return user;
    }

    // Update counselor status (active/inactive)
    async updateStatus(id, isActive) {
        if (!this.admin) return { error: 'Admin client not available' };

        const { data, error } = await this.admin
            .from('users')
            .update({ is_active: isActive })
            .eq('id', id)
            .select()
            .single();

        if (error) return { error: error.message };
        return data;
    }

    emptyStats() {
        return {
            total: 0, active: 0, new: 0, contacted: 0,
            demo_scheduled: 0, demo_done: 0, payment_pending: 0,
            payment_verification: 0, joined: 0, dropped: 0,
            dropReasons: {}
        };
    }

    ensureStatsBucket(stats, cid) {
        if (!stats[cid]) stats[cid] = this.emptyStats();
        return stats[cid];
    }

    applyLeadAccess(query, { userId, actorRole, actorId }) {
        if (userId && actorRole === 'super_admin') {
            return query.eq('counselor_id', userId);
        }
        if (actorRole !== 'super_admin' && actorRole !== 'counselor_head' && actorRole !== 'hr') {
            return query.eq('counselor_id', actorId);
        }
        return query;
    }

    // Get aggregated stats for all counselors
    async getStats({ from, to, userId, actorRole, actorId, leadType, dateBasis = 'lead_created' } = {}) {
        if (!this.admin) return { error: 'Admin client not available' };

        if (dateBasis === 'event') {
            return this.getEventDateStats({ from, to, userId, actorRole, actorId, leadType });
        }

        let query = this.admin
            .from('leads')
            .select('counselor_id, status, created_at, lead_type, drop_reason')
            .or('source.neq."AC Direct Onboarding",source.is.null');

        if (from) query = query.gte('created_at', from);
        if (to) {
            const toDate = to.includes('T') ? to : to + 'T23:59:59.999Z';
            query = query.lte('created_at', toDate);
        }
        if (leadType && leadType !== 'all') query = query.eq('lead_type', leadType);
        query = this.applyLeadAccess(query, { userId, actorRole, actorId });

        const { data: leads, error } = await query;

        if (error) return { error: error.message };

        const stats = {};

        for (const lead of leads) {
            const cid = lead.counselor_id || 'unassigned';
            this.ensureStatsBucket(stats, cid);

            stats[cid].total++;
            if (stats[cid][lead.status] !== undefined) stats[cid][lead.status]++;
            if (!['joined', 'dropped'].includes(lead.status)) stats[cid].active++;

            if (lead.status === 'dropped' && lead.drop_reason) {
                stats[cid].dropReasons[lead.drop_reason] = (stats[cid].dropReasons[lead.drop_reason] || 0) + 1;
            }
        }

        return stats;
    }

    async getEventDateStats({ from, to, userId, actorRole, actorId, leadType } = {}) {
        const stats = {};

        let createdQuery = this.admin
            .from('leads')
            .select('id, counselor_id, status, created_at, lead_type')
            .or('source.neq."AC Direct Onboarding",source.is.null');

        if (from) createdQuery = createdQuery.gte('created_at', from);
        if (to) {
            const toDate = to.includes('T') ? to : to + 'T23:59:59.999Z';
            createdQuery = createdQuery.lte('created_at', toDate);
        }
        if (leadType && leadType !== 'all') createdQuery = createdQuery.eq('lead_type', leadType);
        createdQuery = this.applyLeadAccess(createdQuery, { userId, actorRole, actorId });

        const { data: createdLeads, error: createdError } = await createdQuery;
        if (createdError) return { error: createdError.message };

        for (const lead of createdLeads || []) {
            const bucket = this.ensureStatsBucket(stats, lead.counselor_id || 'unassigned');
            bucket.total++;
            bucket.new++;
        }

        let historyQuery = this.admin
            .from('lead_status_history')
            .select('lead_id, to_status, created_at')
            .not('to_status', 'is', null);

        if (from) historyQuery = historyQuery.gte('created_at', from);
        if (to) {
            const toDate = to.includes('T') ? to : to + 'T23:59:59.999Z';
            historyQuery = historyQuery.lte('created_at', toDate);
        }

        const { data: events, error: historyError } = await historyQuery;
        if (historyError) return { error: historyError.message };

        const leadIds = [...new Set((events || []).map(e => e.lead_id).filter(Boolean))];
        if (!leadIds.length) return stats;

        let leadQuery = this.admin
            .from('leads')
            .select('id, counselor_id, lead_type, source, deleted_at, drop_reason')
            .in('id', leadIds)
            .or('source.neq."AC Direct Onboarding",source.is.null');

        if (leadType && leadType !== 'all') leadQuery = leadQuery.eq('lead_type', leadType);
        leadQuery = this.applyLeadAccess(leadQuery, { userId, actorRole, actorId });

        const { data: leads, error: leadError } = await leadQuery;
        if (leadError) return { error: leadError.message };

        const leadMap = new Map((leads || []).map(lead => [lead.id, lead]));

        for (const event of events || []) {
            const lead = leadMap.get(event.lead_id);
            if (!lead) continue;

            const status = event.to_status;
            const bucket = this.ensureStatsBucket(stats, lead.counselor_id || 'unassigned');
            if (bucket[status] !== undefined) bucket[status]++;
            if (status && !['joined', 'dropped'].includes(status)) bucket.active++;
            if (status === 'dropped' && lead.drop_reason) {
                bucket.dropReasons[lead.drop_reason] = (bucket.dropReasons[lead.drop_reason] || 0) + 1;
            }
        }

        return stats;
    }
}
