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
 * Production voice picker — three mature-sounding adult-female Gemini Live voices,
 * picked to sound like a polished professional woman rather than a youthful/childish
 * tone. Each maps to one of the three core SaaS agent registers: sweet, energetic,
 * confident.
 *
 *   Sulafat    — warm, rich; the "beautiful warm woman" register (sweet).
 *   Laomedeia  — upbeat, bright; lively without sounding childlike (energetic).
 *   Pulcherrima — forward, expressive; assured and commanding (confident).
 *
 * The full Gemini Live catalog (30 voices) is still validated against
 * GEMINI_LIVE_PREBUILT_VOICE_NAMES above for resilience, but only these three
 * are surfaced in the UI to keep the picker focused on the intended brand voice.
 */
export const GEMINI_LIVE_UI_VOICES = [
  {
    id: 'voice_sulafat',
    label: 'Sulafat',
    description: 'Sweet & warm — beautiful, rich adult woman',
    engine: 'Sulafat' as const,
  },
  {
    id: 'voice_laomedeia',
    label: 'Laomedeia',
    description: 'Energetic & upbeat — lively, engaging',
    engine: 'Laomedeia' as const,
  },
  {
    id: 'voice_pulcherrima',
    label: 'Pulcherrima',
    description: 'Confident & forward — assured, commanding',
    engine: 'Pulcherrima' as const,
  },
];

export type GeminiLiveUIVoice = (typeof GEMINI_LIVE_UI_VOICES)[number];

export function normalizeGeminiLiveVoice(raw: string | undefined | null): GeminiLivePrebuiltVoice {
  if (raw == null || typeof raw !== 'string') return 'Sulafat';
  const hit = prebuiltLower.get(raw.trim().toLowerCase());
  return hit ?? 'Sulafat';
}
