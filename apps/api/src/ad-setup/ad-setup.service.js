import { getSupabaseAdminClient } from '../config/supabase.js';

function isCounselorHead(actor) {
  return actor?.role === 'counselor_head';
}

function isSuperAdmin(actor) {
  return actor?.role === 'super_admin';
}

export class AdSetupService {
  async list(actor) {
    if (!isCounselorHead(actor) && !isSuperAdmin(actor)) {
      return { error: 'Access denied: Requires Counselor Head or Super Admin role' };
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { items: [] };

    const { data, error } = await adminClient
      .from('ad_setups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return { items: [] }; // Relation does not exist
      throw new Error(error.message);
    }
    return { items: data || [] };
  }

  async create(payload, actor) {
    if (!isCounselorHead(actor) && !isSuperAdmin(actor)) {
      return { error: 'Access denied' };
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { id: Date.now(), ...payload };

    if (!payload.keyword || !payload.lead_type || !payload.category) {
      return { error: 'keyword, category, and lead_type are required' };
    }

    const { data, error } = await adminClient
      .from('ad_setups')
      .insert({
        keyword: payload.keyword,
        campaign_name: payload.campaign_name || null,
        lead_type: payload.lead_type,
        category: payload.category
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return { error: `Keyword '${payload.keyword}' already exists` };
      throw new Error(error.message);
    }

    return data;
  }

  async update(id, payload, actor) {
    if (!isCounselorHead(actor) && !isSuperAdmin(actor)) {
      return { error: 'Access denied' };
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { error: 'db disabled' };

    const patch = {};
    if (payload.keyword !== undefined) patch.keyword = payload.keyword;
    if (payload.campaign_name !== undefined) patch.campaign_name = payload.campaign_name;
    if (payload.lead_type !== undefined) patch.lead_type = payload.lead_type;
    if (payload.category !== undefined) patch.category = payload.category;

    const { data, error } = await adminClient
      .from('ad_setups')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id, actor) {
    if (!isCounselorHead(actor) && !isSuperAdmin(actor)) {
      return { error: 'Access denied' };
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) return { ok: true };

    const { error } = await adminClient
      .from('ad_setups')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { ok: true };
  }
}
