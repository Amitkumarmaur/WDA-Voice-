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

/** Gemini Live native audio output is always 16-bit PCM mono at 24 kHz. */
export const GEMINI_LIVE_OUTPUT_SAMPLE_RATE = 24000;

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
 * Production voice picker — three of the most grounded adult-female Gemini Live
 * voices, picked specifically to avoid the cartoonish/over-expressive feel of
 * the more performative voices in the catalog. These are the "broadcast / news
 * anchor" register: smooth, clear, gentle.
 *
 *   Despina      — smooth, level (poised professional).
 *   Erinome      — clear, articulate (broadcast clarity).
 *   Sulafat      — warm, sweet (soft melodic tone — Indian playback-singer register).
 *
 * The full Gemini Live catalog (30 voices) is still validated against
 * GEMINI_LIVE_PREBUILT_VOICE_NAMES above for resilience, but only these three
 * are surfaced in the UI. Combine these with a non-theatrical system prompt
 * (no "smile while speaking" / "raise energy when excited") to keep delivery
 * realistic.
 */
export const GEMINI_LIVE_UI_VOICES = [
  {
    id: 'voice_aoede',
    label: 'Aoede',
    description: 'Natural & breezy — most human-sounding',
    engine: 'Aoede' as const,
  },
  {
    id: 'voice_despina',
    label: 'Despina',
    description: 'Smooth & composed — poised professional',
    engine: 'Despina' as const,
  },
  {
    id: 'voice_erinome',
    label: 'Erinome',
    description: 'Clear & articulate — broadcast precision',
    engine: 'Erinome' as const,
  },
  {
    id: 'voice_sulafat',
    label: 'Sulafat',
    description: 'Sweet & warm — soft melodic Indian tone',
    engine: 'Sulafat' as const,
  },
];

export type GeminiLiveUIVoice = (typeof GEMINI_LIVE_UI_VOICES)[number];

export function normalizeGeminiLiveVoice(raw: string | undefined | null): GeminiLivePrebuiltVoice {
  if (raw == null || typeof raw !== 'string') return 'Despina';
  const trimmed = raw.trim().toLowerCase();
  // Vindemiatrix was replaced by Sulafat for a sweeter, warmer delivery.
  if (trimmed === 'vindemiatrix') return 'Sulafat';
  const hit = prebuiltLower.get(trimmed);
  return hit ?? 'Despina';
}
