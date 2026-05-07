import { normalizeGeminiLiveVoice } from '../config/geminiLive';
import { getSupabase, getSupabaseUrl } from '../lib/supabase';
import { VoiceProfile } from '../types';

function guessAudioMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a') || n.endsWith('.aac')) return 'audio/mp4';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  if (n.endsWith('.flac')) return 'audio/flac';
  return 'audio/wav';
}

/** Base64 for binary uploads (chunked to stay under String.fromCharCode spread limits). */
function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    let s = '';
    for (let j = 0; j < slice.length; j++) {
      s += String.fromCharCode(slice[j]!);
    }
    parts.push(s);
  }
  return btoa(parts.join(''));
}

async function invokeGeminiGenerate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in for this action.');
  }
  const url = `${getSupabaseUrl()}/functions/v1/gemini-generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(res.ok ? 'Invalid response from voice analysis.' : res.statusText || 'Request failed');
  }
  if (!res.ok) {
    throw new Error((json.error as string) || res.statusText);
  }
  return json;
}

function rowToProfile(row: Record<string, unknown>): VoiceProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    tone: row.tone as string,
    pace: row.pace as string,
    pitch: row.pitch as string,
    intonation: row.intonation as string,
    nuances: row.nuances as string,
    energyLevel: row.energy_level as string,
    recommendedVoice: row.recommended_voice as string,
    createdAt: row.created_at,
  };
}

export const VoiceService = {
  async analyzeVoiceSample(organizationId: string, file: File): Promise<VoiceProfile> {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer));
    const mimeType = guessAudioMimeType(file);
    const out = await invokeGeminiGenerate({
      action: 'analyze_voice',
      mimeType,
      data: base64Data,
    });
    let profileData: Record<string, unknown>;
    try {
      const raw = out.profileJson;
      profileData =
        typeof raw === 'string' && raw.trim()
          ? JSON.parse(raw.trim())
          : ({} as Record<string, unknown>);
    } catch {
      throw new Error('Voice analysis returned unreadable data. Please try another clip or format.');
    }
    const supabase = getSupabase();
    const str = (k: string, fallback: string) =>
      typeof profileData[k] === 'string' && (profileData[k] as string).trim()
        ? (profileData[k] as string).trim()
        : fallback;

    const { data, error } = await supabase
      .from('voice_profiles')
      .insert({
        organization_id: organizationId,
        name: str('name', 'Voice profile'),
        description: str('description', 'Derived from uploaded sample.'),
        tone: str('tone', 'neutral'),
        pace: str('pace', 'moderate'),
        pitch: str('pitch', 'medium'),
        intonation: str('intonation', 'conversational'),
        nuances: str('nuances', ''),
        energy_level: str('energyLevel', 'medium'),
        recommended_voice: normalizeGeminiLiveVoice(profileData.recommendedVoice as string | undefined),
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToProfile(data as Record<string, unknown>);
  },

  async getActiveVoiceProfile(organizationId: string): Promise<VoiceProfile | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToProfile(data as Record<string, unknown>);
  },

  async deleteVoiceProfile(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('voice_profiles').delete().eq('id', id);
    if (error) throw error;
  },
};
