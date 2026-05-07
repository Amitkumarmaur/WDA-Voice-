import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSupabase, isSupabaseEnvConfigured } from '../lib/supabase';
import { TenantProvider } from '../lib/tenantContext';
import VoiceAgent from './VoiceAgent';
import { KnowledgeItem, VoicePersona, VoiceProfile } from '../types';
import { VOICE_PERSONAS } from '../constants';
import { Loader2, Phone } from 'lucide-react';

type Bundle = {
  organization_id: string;
  public_slug: string;
  knowledge_items: KnowledgeItem[];
  agent_settings: {
    intro?: string;
    persona_id?: string;
    language?: 'hindi' | 'english';
  };
  voice_profile: VoiceProfile | null;
};

export default function PublicEmbedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!isSupabaseEnvConfigured()) {
        setError('Missing or invalid Supabase configuration (.env.local)');
        setBundle(null);
        setLoading(false);
        return;
      }
      if (!slug) {
        setError('Missing slug');
        setBundle(null);
        setLoading(false);
        return;
      }
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc('get_public_agent_bundle', { p_slug: slug });
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setBundle(null);
        setLoading(false);
        return;
      }
      if (!data) {
        setError('Agent not found');
        setBundle(null);
        setLoading(false);
        return;
      }
      const raw = data as Record<string, unknown>;
      const kb = (raw.knowledge_items as Record<string, unknown>[]) ?? [];
      const mapped: KnowledgeItem[] = kb.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        content: row.content as string,
        source: row.source as string,
        type: row.type as KnowledgeItem['type'],
        createdAt: row.created_at,
      }));
      const vp = raw.voice_profile as Record<string, unknown> | null;
      const voiceProfile: VoiceProfile | null = vp
        ? {
            id: vp.id as string,
            name: vp.name as string,
            description: vp.description as string,
            tone: vp.tone as string,
            pace: vp.pace as string,
            pitch: vp.pitch as string,
            intonation: vp.intonation as string,
            nuances: vp.nuances as string,
            energyLevel: vp.energy_level as string,
            recommendedVoice: vp.recommended_voice as string,
            createdAt: vp.created_at,
          }
        : null;
      const settings = (raw.agent_settings as Record<string, unknown>) || {};
      setBundle({
        organization_id: raw.organization_id as string,
        public_slug: raw.public_slug as string,
        knowledge_items: mapped,
        agent_settings: {
          intro: (settings.intro as string) || undefined,
          persona_id: (settings.persona_id as string) || undefined,
          language: (settings.language as 'hindi' | 'english') || 'english',
        },
        voice_profile: voiceProfile,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-slate-600 mb-4">{error || 'Not found'}</p>
        <Link to="/" className="text-indigo-600 font-medium hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const persona: VoicePersona | null =
    VOICE_PERSONAS.find((p) => p.id === bundle.agent_settings.persona_id) ?? VOICE_PERSONAS[0];
  const intro =
    bundle.agent_settings.intro ||
    'Hello, thanks for reaching out. How can I help you today?';
  const language = bundle.agent_settings.language === 'hindi' ? 'hindi' : 'english';

  const tenant = {
    mode: 'public' as const,
    slug: bundle.public_slug,
    organizationId: bundle.organization_id,
  };

  return (
    <TenantProvider value={tenant}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Phone size={16} className="text-indigo-600" />
            <span>Voicera · public agent</span>
          </div>
          <VoiceAgent
            knowledgeItems={bundle.knowledge_items}
            voiceProfile={bundle.voice_profile}
            selectedPersona={persona}
            language={language}
            intro={intro}
            tenant={tenant}
          />
        </div>
      </div>
    </TenantProvider>
  );
}
