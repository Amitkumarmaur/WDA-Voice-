import { getSupabase } from '../lib/supabase';

export type AdminDirectoryRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  user_created_at: string;
  user_updated_at: string;
  user_is_platform_admin: boolean;
  organization_id: string | null;
  org_role: string | null;
  org_name: string | null;
  public_slug: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  monthly_voice_minutes_used: number | null;
  monthly_voice_minutes_limit: number | null;
  org_created_at: string | null;
  knowledge_count: number | null;
  leads_count: number | null;
  appointments_count: number | null;
  transcripts_count: number | null;
  voice_profiles_count: number | null;
};

export type AdminUserDetail = {
  profile: Record<string, unknown>;
  memberships: AdminMembershipDetail[];
};

export type AdminMembershipDetail = {
  role: string;
  organization: Record<string, unknown>;
  agent_settings: Record<string, unknown> | null;
  voice_profile: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  counts: {
    knowledge: number;
    leads: number;
    appointments: number;
    transcripts: number;
    voice_profiles: number;
  };
  recent_leads: Record<string, unknown>[];
  recent_appointments: Record<string, unknown>[];
  recent_transcripts: { id: string; created_at: string; message_count: number }[];
  sample_knowledge: Record<string, unknown>[];
};

export type AdminOverview = {
  users_count: number;
  platform_admins_count: number;
  organizations_count: number;
  contact_submissions_count: number;
  total_leads: number;
  total_appointments: number;
};

export type AdminContactSubmission = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  company?: string | null;
};

export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled';
export type PlanName = 'free' | 'starter' | 'pro' | 'enterprise';

function rpcErrorMessage(error: { message?: string; code?: string; details?: string }): string {
  const msg = (error.message ?? '').toLowerCase();
  const map: Record<string, string> = {
    cannot_delete_self: 'You cannot delete your own account from the admin panel.',
    cannot_delete_last_admin: 'Cannot delete the last platform admin.',
    cannot_demote_self: 'You cannot remove your own admin access.',
    cannot_remove_last_admin: 'Cannot remove the last platform admin.',
    user_not_found: 'User not found.',
    organization_not_found: 'Workspace not found.',
    not_allowed: 'Admin access required.',
    not_authenticated: 'Please sign in again.',
  };
  for (const [key, text] of Object.entries(map)) {
    if (msg.includes(key)) return text;
  }
  return error.message || 'Request failed';
}

export const AdminService = {
  async isPlatformAdmin(): Promise<boolean> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) {
      console.error('is_platform_admin', error);
      return false;
    }
    return !!data;
  },

  async getOverview(): Promise<AdminOverview> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_overview');
    if (error) throw new Error(rpcErrorMessage(error));
    const o = (data ?? {}) as Partial<AdminOverview>;
    return {
      users_count: o.users_count ?? 0,
      platform_admins_count: o.platform_admins_count ?? 0,
      organizations_count: o.organizations_count ?? 0,
      contact_submissions_count: o.contact_submissions_count ?? 0,
      total_leads: o.total_leads ?? 0,
      total_appointments: o.total_appointments ?? 0,
    };
  },

  async getContactSubmissions(limit = 50): Promise<AdminContactSubmission[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_contact_submissions', { p_limit: limit });
    if (error) throw new Error(rpcErrorMessage(error));
    if (!Array.isArray(data)) return [];
    return data as AdminContactSubmission[];
  },

  async getUsersDirectory(): Promise<AdminDirectoryRow[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_users_directory');
    if (error) throw new Error(rpcErrorMessage(error));
    if (!data) return [];
    const rows = data as unknown;
    if (!Array.isArray(rows)) return [];
    return rows as AdminDirectoryRow[];
  },

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_user_detail', { p_user_id: userId });
    if (error) throw new Error(rpcErrorMessage(error));
    if (data == null) return null;
    const payload = data as {
      profile: Record<string, unknown>;
      memberships?: AdminMembershipDetail[];
    };
    return {
      profile: payload.profile,
      memberships: Array.isArray(payload.memberships) ? payload.memberships : [],
    };
  },

  async setPlatformAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_set_platform_admin', {
      p_user_id: userId,
      p_is_admin: isAdmin,
    });
    if (error) throw new Error(rpcErrorMessage(error));
  },

  async deleteUser(userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
    if (error) throw new Error(rpcErrorMessage(error));
  },

  async updateOrganization(
    orgId: string,
    opts: {
      subscriptionStatus?: SubscriptionStatus | null;
      planName?: PlanName | null;
      voiceLimit?: number | null;
      resetUsage?: boolean;
    }
  ): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_update_organization', {
      p_org_id: orgId,
      p_subscription_status: opts.subscriptionStatus ?? null,
      p_plan_name: opts.planName ?? null,
      p_voice_limit: opts.voiceLimit ?? null,
      p_reset_usage: opts.resetUsage ?? false,
    });
    if (error) throw new Error(rpcErrorMessage(error));
  },

  async deleteOrganization(orgId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_delete_organization', { p_org_id: orgId });
    if (error) throw new Error(rpcErrorMessage(error));
  },
};
