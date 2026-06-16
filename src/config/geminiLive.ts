/**
 * Gemini Live native audio — keep in sync with Google docs:
 * - Model: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
 * - Voices: https://ai.google.dev/gemini-api/docs/live-api/capabilities (same 30 as TTS)
 *
 * gemini-3.1-flash-live-preview is chosen over the non-Flash Live variant because:
 *   - native audio output (the agent generates speech directly, not via TTS pass)
 *   - lowest end-to-end latency in the Live API family (interruptible turn-taking)
 *   - cheapest per-minute pricing of the realtime tier
 * Mirror any change here in supabase/functions/gemini-generate/index.ts (GEMINI_MODEL).
 */

export const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

/** All documented prebuilt voice names for Live / speech generation (canonical casing). */
export const GEMINI_LIVE_PREBUILT_VOICE_NAMES = [
  'Zephyr',
  'Kore',
  'Orus',
  'Autonoe',
  'Umbriel',
  'Erinome',
  'Laomedeia',
  'Schedar',
  'Achird',
  'Sadachbia',
  'Puck',
  'Fenrir',
  'Aoede',
  'Enceladus',
  'Algieba',
  'Algenib',
  'Achernar',
  'Gacrux',
  'Zubenelgenubi',
  'Sadaltager',
  'Charon',
  'Leda',
  'Callirrhoe',
  'Iapetus',
  'Despina',
  'Rasalgethi',
  'Alnilam',
  'Pulcherrima',
  'Vindemiatrix',
  'Sulafat',
] as const;

export type GeminiLivePrebuiltVoice = (typeof GEMINI_LIVE_PREBUILT_VOICE_NAMES)[number];

const prebuiltLower = new Map<string, GeminiLivePrebuiltVoice>(
  GEMINI_LIVE_PREBUILT_VOICE_NAMES.map((n) => [n.toLowerCase(), n])
);

/**
 * Production voice picker — the three most human-sounding Gemini Live voices,
 * selected for a SaaS support / sales / customer-success agent.
 *
 *   Aoede — warm, conversational; most natural for empathetic support flows.
 *   Leda  — lively, youthful; best for outbound sales & customer-success cadence.
 *   Kore  — professional, steady; clearest articulation for explanations.
 *
 * The full Gemini Live catalog (30 voices) is still validated against
 * GEMINI_LIVE_PREBUILT_VOICE_NAMES above for resilience, but only these
 * three are surfaced in the UI to keep the picker focused.
 */
export const GEMINI_LIVE_UI_VOICES = [
  {
    id: 'voice_aoede',
    label: 'Aoede',
    description: 'Warm & conversational — most natural for support',
    engine: 'Aoede' as const,
  },
  {
    id: 'voice_leda',
    label: 'Leda',
    description: 'Lively & youthful — best for sales & onboarding',
    engine: 'Leda' as const,
  },
  {
    id: 'voice_kore',
    label: 'Kore',
    description: 'Professional & steady — clearest for explanations',
    engine: 'Kore' as const,
  },
];

export type GeminiLiveUIVoice = (typeof GEMINI_LIVE_UI_VOICES)[number];

export function normalizeGeminiLiveVoice(raw: string | undefined | null): GeminiLivePrebuiltVoice {
  if (raw == null || typeof raw !== 'string') return 'Aoede';
  const hit = prebuiltLower.get(raw.trim().toLowerCase());
  return hit ?? 'Aoede';
}
