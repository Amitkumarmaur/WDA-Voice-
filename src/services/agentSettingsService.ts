import { getSupabase } from '../lib/supabase';

export type AgentSettingsRow = {
  organization_id: string;
  intro: string;
  persona_id: string;
  language: 'hindi' | 'english';
  updated_at: string;
};

export const AgentSettingsService = {
  async get(organizationId: string): Promise<AgentSettingsRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('agent_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    return data as AgentSettingsRow | null;
  },

  async upsert(
    organizationId: string,
    patch: Partial<Pick<AgentSettingsRow, 'intro' | 'persona_id' | 'language'>>
  ): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('agent_settings').upsert(
      {
        organization_id: organizationId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    );
    if (error) throw error;
  },
};
