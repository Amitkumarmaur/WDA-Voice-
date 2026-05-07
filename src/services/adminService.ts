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

  async getUsersDirectory(): Promise<AdminDirectoryRow[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_users_directory');
    if (error) throw error;
    if (!data) return [];
    const rows = data as unknown;
    if (!Array.isArray(rows)) return [];
    return rows as AdminDirectoryRow[];
  },

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_get_user_detail', { p_user_id: userId });
    if (error) throw error;
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
};
