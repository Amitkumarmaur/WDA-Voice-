import { getSupabase } from '../lib/supabase';
import type { TenantRef } from '../lib/tenantContext';
import { Lead, Appointment, Message } from '../types';

export const BusinessService = {
  async captureLead(tenant: TenantRef | null, lead: Omit<Lead, 'id' | 'createdAt'>): Promise<string | undefined> {
    if (!tenant) {
      console.warn('captureLead skipped: no tenant context');
      return undefined;
    }
    const supabase = getSupabase();
    if (tenant.mode === 'public') {
      const { data, error } = await supabase.rpc('capture_public_lead', {
        p_slug: tenant.slug,
        p_name: lead.name,
        p_email: lead.email,
        p_interest: lead.interest ?? null,
        p_conversation_id: lead.conversationId ?? null,
        p_phone: lead.phone ?? null,
      });
      if (error) throw error;
      return data as string;
    }
    const { data, error } = await supabase
      .from('leads')
      .insert({
        organization_id: tenant.organizationId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone ?? null,
        interest: lead.interest ?? null,
        conversation_id: lead.conversationId ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async scheduleAppointment(
    tenant: TenantRef | null,
    appointment: Omit<Appointment, 'id' | 'createdAt'>
  ): Promise<string | undefined> {
    if (!tenant) {
      console.warn('scheduleAppointment skipped: no tenant context');
      return undefined;
    }
    const supabase = getSupabase();
    const date =
      typeof appointment.date === 'string'
        ? appointment.date
        : (appointment.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
          new Date(appointment.date as string).toISOString();

    if (tenant.mode === 'public') {
      const { data, error } = await supabase.rpc('schedule_public_appointment', {
        p_slug: tenant.slug,
        p_name: appointment.name,
        p_email: appointment.email,
        p_date: date,
        p_notes: appointment.notes ?? null,
        p_phone: appointment.phone ?? null,
      });
      if (error) throw error;
      return data as string;
    }
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        organization_id: tenant.organizationId,
        name: appointment.name,
        email: appointment.email,
        phone: appointment.phone ?? null,
        date,
        notes: appointment.notes ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async saveTranscript(
    tenant: TenantRef | null,
    messages: Message[],
    durationSeconds?: number
  ): Promise<string | undefined> {
    if (!tenant || messages.length === 0) return undefined;
    const supabase = getSupabase();
    const payload = messages.map((m) => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
    }));
    if (tenant.mode === 'public') {
      const { data, error } = await supabase.rpc('save_public_transcript', {
        p_slug: tenant.slug,
        p_messages: payload,
        p_duration_seconds: durationSeconds ?? null,
      });
      if (error) throw error;
      return data as string;
    }
    const { data, error } = await supabase
      .from('transcripts')
      .insert({
        organization_id: tenant.organizationId,
        messages: payload,
        duration_seconds: durationSeconds ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async logVoiceUsage(
    tenant: TenantRef,
    transcriptId: string | undefined,
    durationSeconds: number
  ): Promise<void> {
    if (durationSeconds <= 0 || !transcriptId) return;
    const supabase = getSupabase();
    const secs = Math.round(durationSeconds);
    if (tenant.mode === 'public') {
      const { error } = await supabase.rpc('log_public_voice_usage', {
        p_slug: tenant.slug,
        p_transcript_id: transcriptId,
        p_duration_seconds: secs,
      });
      if (error) console.warn('logVoiceUsage failed:', error.message);
      return;
    }
    const { error } = await supabase.rpc('log_voice_usage', {
      p_organization_id: tenant.organizationId,
      p_transcript_id: transcriptId,
      p_duration_seconds: secs,
    });
    if (error) console.warn('logVoiceUsage failed:', error.message);
  },
};
