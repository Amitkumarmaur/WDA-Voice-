/**
 * Gemini Live native audio — keep in sync with Google docs:
 * - Model: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
 * - Voices: https://ai.google.dev/gemini-api/docs/live-api/capabilities (same 30 as TTS)
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

/** Sweet/warm female voices available in the voice picker. */
export const GEMINI_LIVE_UI_VOICES = [
  { id: 'voice_leda',          label: 'Leda',          engine: 'Leda'          as const },
  { id: 'voice_sulafat',       label: 'Sulafat',       engine: 'Sulafat'       as const },
  { id: 'voice_achernar',      label: 'Achernar',      engine: 'Achernar'      as const },
  { id: 'voice_aoede',         label: 'Aoede',         engine: 'Aoede'         as const },
  { id: 'voice_callirrhoe',    label: 'Callirrhoe',    engine: 'Callirrhoe'    as const },
  { id: 'voice_enceladus',     label: 'Enceladus',     engine: 'Enceladus'     as const },
  { id: 'voice_zephyr',        label: 'Zephyr',        engine: 'Zephyr'        as const },
  { id: 'voice_pulcherrima',   label: 'Pulcherrima',   engine: 'Pulcherrima'   as const },
  { id: 'voice_vindemiatrix',  label: 'Vindemiatrix',  engine: 'Vindemiatrix'  as const },
];

export function normalizeGeminiLiveVoice(raw: string | undefined | null): GeminiLivePrebuiltVoice {
  if (raw == null || typeof raw !== 'string') return 'Kore';
  const hit = prebuiltLower.get(raw.trim().toLowerCase());
  return hit ?? 'Kore';
}
