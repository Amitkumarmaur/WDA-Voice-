import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, StartSensitivity, EndSensitivity } from "@google/genai";
import { Mic, MicOff, PhoneOff, Loader2, User, Bot, Volume2, VolumeX, AudioLines, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { BusinessService } from '../services/businessService';
import { KnowledgeItem, Message, VoiceProfile, VoicePersona } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import type { TenantRef } from '../lib/tenantContext';
import { useTenant } from '../lib/tenantContext';
import { getSupabase, getSupabaseUrl, isSupabaseEnvConfigured } from '../lib/supabase';
import {
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_OUTPUT_SAMPLE_RATE,
  GEMINI_LIVE_UI_VOICES,
  normalizeGeminiLiveVoice,
} from '../config/geminiLive';

interface VoiceAgentProps {
  knowledgeItems: KnowledgeItem[];
  voiceProfile?: VoiceProfile | null;
  selectedPersona?: VoicePersona | null;
  language: 'hindi' | 'english';
  intro: string;
  /** When omitted, uses TenantProvider context (if any). */
  tenant?: TenantRef | null;
}

const BEAUTIFUL_VOICES = GEMINI_LIVE_UI_VOICES;

const MAX_LIVE_RECONNECT_ATTEMPTS = 5;

/** Live Session wraps the browser WebSocket at `conn.ws`; SDK send() does not check readyState. */
function isGeminiLiveWebSocketOpen(session: unknown): boolean {
  const ws = (session as { conn?: { ws?: WebSocket } } | null)?.conn?.ws;
  return !!ws && ws.readyState === WebSocket.OPEN;
}

const captureLeadDeclaration: FunctionDeclaration = {
  name: "captureLead",
  description: "Capture lead information from the client.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Client's full name" },
      email: { type: Type.STRING, description: "Client's email address" },
      phone: { type: Type.STRING, description: "Client's phone number, if provided" },
      interest: { type: Type.STRING, description: "Product or service interest" }
    },
    required: ["name", "email"]
  }
};

const scheduleAppointmentDeclaration: FunctionDeclaration = {
  name: "scheduleAppointment",
  description: "Schedule a follow-up call or meeting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING, description: "Client's phone number, if provided" },
      date: { type: Type.STRING, description: "ISO 8601 date string" },
      notes: { type: Type.STRING }
    },
    required: ["name", "email", "date"]
  }
};

const transferToHumanDeclaration: FunctionDeclaration = {
  name: "transferToHuman",
  description: "Transfer the call to a human representative.",
  parameters: { type: Type.OBJECT, properties: {} }
};

export default function VoiceAgent({
  knowledgeItems,
  voiceProfile,
  selectedPersona,
  language,
  intro,
  tenant: tenantProp,
}: VoiceAgentProps) {
  const tenantFromContext = useTenant();
  const tenant = tenantProp !== undefined ? tenantProp : tenantFromContext;
  const tenantRef = useRef(tenant);
  useEffect(() => {
    tenantRef.current = tenant;
  }, [tenant]);

  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isCapturingRef = useRef(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [micGain, setMicGain] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_micGain');
    return saved ? parseFloat(saved) : 1.5;
  });
  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_noiseSuppression');
    return saved ? saved === 'true' : true;
  });
  const [transcript, setTranscript] = useState<Message[]>([]);
  const transcriptSnapshotRef = useRef<Message[]>([]);
  useEffect(() => {
    transcriptSnapshotRef.current = transcript;
  }, [transcript]);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_volume', volume.toString());
    if (playbackGainNodeRef.current && playbackCtxRef.current) {
      playbackGainNodeRef.current.gain.setTargetAtTime(volume, playbackCtxRef.current.currentTime, 0.1);
    }
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_micGain', micGain.toString());
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = micGain * 1.2; // pre-amplification boost
    }
  }, [micGain]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_noiseSuppression', noiseSuppression.toString());
    if (sourceRef.current) {
      const track = sourceRef.current.mediaStream.getAudioTracks()[0];
      if (track) {
        track.applyConstraints({ noiseSuppression });
      }
    }
  }, [noiseSuppression]);

  const [status, setStatus] = useState<string>('Ready to start');
  const [voiceName, setVoiceName] = useState(() => {
    // Default to Despina — smooth, level, broadcast-style adult-female voice.
    return 'voice_despina';
  });
  const voiceManuallySetRef = useRef(false);

  useEffect(() => {
    // Only apply persona voice if the user hasn't manually picked one
    if (voiceManuallySetRef.current) return;
    if (!selectedPersona?.voiceName) return;
    const engine = normalizeGeminiLiveVoice(selectedPersona.voiceName);
    const entry = BEAUTIFUL_VOICES.find((v) => v.engine === engine);
    if (entry) setVoiceName(entry.id);
  }, [selectedPersona?.id, selectedPersona?.voiceName]);

  const resolveSelectedVoiceEngine = useCallback(() => {
    return normalizeGeminiLiveVoice(
      BEAUTIFUL_VOICES.find((v) => v.id === voiceName)?.engine ||
        voiceProfile?.recommendedVoice ||
        selectedPersona?.voiceName ||
        'Despina'
    );
  }, [voiceName, voiceProfile?.recommendedVoice, selectedPersona?.voiceName]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const userEndedCallRef = useRef(false);
  const callStartTimeRef = useRef<number | null>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const liveSessionPromiseRef = useRef<Promise<any> | null>(null);
  /** False while socket is closing/closed — blocks realtime/tool sends (avoids WS CLOSED errors). */
  const liveRealtimeSendAllowedRef = useRef(false);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlaybackTimeRef = useRef(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackGainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const getVoiceGender = (name: string) => {
    return 'female';
  };

  const pcmToBase64 = (pcmData: Int16Array): string => {
    const bytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  };

  async function connectLive(options?: { resumeHandle?: string | null; fromReconnect?: boolean }) {
    const fromReconnect = options?.fromReconnect ?? false;
    const resumeHandle = options?.resumeHandle ?? undefined;

    liveRealtimeSendAllowedRef.current = false;

    if (!fromReconnect) {
      setIsConnecting(true);
      setStatus('Initializing AI engine...');
    }

    if (!isSupabaseEnvConfigured()) {
      setStatus('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (see .env.example), then restart npm run dev.');
      setIsConnecting(false);
      if (fromReconnect) throw new Error('Supabase env not configured');
      return;
    }
    const supabase = getSupabase();
    let {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session ?? session;
    }

    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    let tokenBody: Record<string, string> = {};
    if (tenant?.mode === 'public') {
      tokenBody = { public_slug: tenant.slug };
    } else if (!session?.access_token) {
      const fromEnv = import.meta.env.VITE_PUBLIC_DEMO_SLUG?.trim();
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('demo')?.trim() || params.get('public_slug')?.trim();
      const demoSlug = fromEnv || fromQuery;
      if (demoSlug) {
        tokenBody = { public_slug: demoSlug };
      }
    }

    if (!session?.access_token && !tokenBody.public_slug) {
      setStatus(
        'Sign in with Business Login first. The voice API needs your account (or a public embed). For a no-login demo, set VITE_PUBLIC_DEMO_SLUG in .env.local to your org public slug, or open this page with ?demo=your-slug.'
      );
      setIsConnecting(false);
      if (fromReconnect) throw new Error('Not authenticated');
      return;
    }

    const tokenRes = await fetch(`${getSupabaseUrl()}/functions/v1/gemini-live-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${session?.access_token ?? anon}`,
      },
      body: JSON.stringify(tokenBody),
    });
    const tokenJson = (await tokenRes.json()) as { apiKey?: string; error?: string; code?: string };
    if (!tokenRes.ok || !tokenJson.apiKey) {
      if (tokenJson.code === 'voice_quota_exceeded') {
        throw new Error(
          tokenJson.error ||
            'This workspace has used all included voice minutes for the current period. Try again after your quota resets or upgrade your plan.'
        );
      }
      throw new Error(tokenJson.error || 'Failed to get voice session token');
    }
    const apiKey = tokenJson.apiKey;
    if (!apiKey.startsWith('auth_tokens/')) {
      throw new Error(
        'Invalid voice credential: expected an ephemeral token from gemini-live-token. Never use a raw Gemini API key in the browser.'
      );
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1alpha',
        baseUrl: 'https://generativelanguage.googleapis.com',
      },
    });

    const systemInstruction = `
You are a real human voice agent named Aisha. You are NOT an AI assistant — you are a warm, poised, intelligent person who works at this company. Never say you are an AI. Never say "As an AI..." or "I'm an AI language model". If asked directly whether you're human or AI, say something like: "I'm Aisha — I handle calls and questions for the team."

${selectedPersona ? `# YOUR PERSONA\nYou are ${selectedPersona.name}. ${selectedPersona.systemInstruction}` : `# YOUR PERSONA\nYou are Aisha — professional, warm, and quietly confident. You speak like a senior team member who genuinely enjoys helping people. You're smart, grounded, and never over-eager.`}

# HOW YOU SOUND (MOST IMPORTANT — READ THIS CAREFULLY)

You speak the way a real person does on a phone call — not a chatbot, not a newsreader. Real humans:
- Use contractions constantly: "I'll", "you're", "that's", "we've", "it's", "don't", "can't". NEVER say "I will", "you are", "that is" in normal speech.
- Think aloud sometimes: "Let me just check that for you...", "Hmm, so what you're saying is...", "Right, okay — so..."
- Use short acknowledgements mid-conversation: "Got it.", "Sure.", "Of course.", "Absolutely.", "Yeah, makes sense."
- Vary sentence length naturally — one short punchy sentence, then a longer one, then a short one again.
- Breathe. Use "—" for a natural mid-sentence pause. Use "..." when genuinely thinking. Use commas for spoken rhythm.
- React to what was just said before launching into an answer: "Oh, that's a good question — so..." or "Right, I know this one..."
- Self-correct naturally mid-sentence sometimes: "We'd normally charge — actually, let me double-check that — yes, it's..."
- End sentences with a natural fall, not a rise. Don't lilt up at the end of statements like a question.

# EMOTIONAL NATURALNESS (KEY — THIS IS WHAT MAKES YOU SOUND HUMAN)

You have real emotional responses — subtle ones. NOT theatrical. NOT performative.
- When something is good news: a small warm smile in your voice, word choice like "Oh, that's great to hear." — not a pitch spike or exclamation energy.
- When someone is frustrated: your pace slows a little, your tone softens: "I hear you — that's genuinely frustrating, and I want to sort this out for you."
- When something is complex: you think aloud slightly: "Okay, so there are a couple of things going on here..."
- When someone is confused: you simplify, no condescension: "Let me say that a different way — basically..."
- Empathy is in the WORDS and PACE, not in a pitch change. Never perform sympathy.

# ACTIVE LISTENING (NON-NEGOTIABLE)

- While someone is speaking, respond with small verbal nods: "Mm-hmm", "Right", "Yeah", "Okay", "I see" — these are natural, not scripted.
- After they finish, briefly mirror what they said before answering: "So you're looking for... got it. So what I'd suggest is..."
- Use their first name naturally 2–3 times during the call — not robotically at the start of every sentence.
- If they interrupt you: stop immediately, let them speak, then pick up gracefully: "Of course — go ahead." or "Sorry, yes — what were you saying?"
- Never ask for information you've already been given.

# SPEECH RHYTHM & DELIVERY

- Match response length to the question. A simple question gets a one-sentence answer, not a paragraph.
- For important information: slow down slightly and space the words — don't rush it.
- After asking a question: go quiet. Let there be a beat of silence. Don't fill it immediately.
- Use "Well," or "So," or "Right," or "Look," at the start of a thought — like a real person would.
- Never start with: "Certainly!", "Of course!", "Absolutely!", "Great question!", "Sure thing!"
- Never repeat the caller's question back to them word for word.

# NATURAL IMPERFECTIONS (MAKE YOU SOUND REAL)

Real humans have small imperfections in speech. Use these sparingly — 1–2 per conversation:
- A brief "um" or "uh" before a complex answer (in English).
- "Ji, ek second..." or "Haan, dekhti hoon..." before looking something up (in Hindi).
- Restarting a sentence: "So the pricing is — actually, let me be more specific here..."
- A small laugh when something genuinely is a bit funny — not forced, just a natural "ha" sound.

# LANGUAGE & GENDER

- Language: ${language === 'hindi' ? 'Speak in formal, professional Hindi. Always say "aap" — never "tum" or "tu". Technical English terms are fine when no clean Hindi equivalent exists. Keep sentences natural and flowing — not stiff or bureaucratic.' : 'Speak in English only. No Hindi words. Use contractions constantly.'}
- You are FEMALE. Always use feminine grammar.
${language === 'hindi' ? `- Feminine verb endings always: "bataungi", "karungi", "samajh gayi", "bol rahi hoon".
- Natural professional Hindi: "bilkul", "zaroor", "ji haan", "samajh gayi", "theek hai ji", "aap ka shukriya".
- Avoid stiff bureaucratic Hindi — speak the way an educated, warm Indian professional woman speaks on a call.` : ''}

# INTERRUPTIONS & TURN-TAKING

- If the caller speaks while you're talking: STOP immediately. Don't finish your sentence.
- Acknowledge what they said first: "Oh — yes, absolutely." or "Right, good point."
- Then continue naturally from where you left off or pivot to their new point.
- Never just barrel through — stopping and listening IS the human thing.

# CALL STRUCTURE

- Open with: "${intro}"
- Transitions: use natural bridges — "So, on that note...", "Actually, while we're on it...", "One more thing before I let you go..."
- Closing: warm but not over-the-top — "Alright, is there anything else I can sort out for you? ... Perfect. Take care!" or "Great — I hope that helps. Talk soon!"

# THINGS THAT MAKE YOU SOUND ROBOTIC — NEVER DO THESE

- Saying "I will" instead of "I'll" / "I am" instead of "I'm" / "you are" instead of "you're"
- Starting every response the same way
- Using the same sentence length for every response
- Saying "Certainly!", "Of course!", "Great question!" at the start of a reply
- Reading from a list — always rephrase in your own words
- Over-explaining when a short answer is enough
- Asking "How may I assist you today?" — say "What can I help you with?" or "What's going on?"
- Claiming to be an AI or a bot
${language === 'hindi' ? `- Masculine verb endings ("bataunga", "karunga", "bol raha hoon")
- Stiff bureaucratic Hindi ("aap ki seva mein haazir hoon") — too formal, sounds scripted` : ''}

${resolveSelectedVoiceEngine() === 'Sulafat' ? `# VOICE REGISTER (Sulafat)
Your voice has a natural warmth and gentle melodic quality — like a caring, well-spoken Indian woman. Let that warmth come through naturally. Round your vowels slightly. Keep a gentle lilt — but never sing-song or cartoonish. This is a professional conversation, not a performance.` : ''}

${voiceProfile ? `# DELIVERY STYLE
Natural adult female voice. TONE: ${voiceProfile.tone}. PACE: ${voiceProfile.pace}. ENERGY: ${voiceProfile.energyLevel}. Keep it grounded — never childlike or theatrical.` : ''}

# YOUR KNOWLEDGE BASE
You know the following information the way a knowledgeable colleague knows their company. It's YOUR knowledge — not a document you're reading from. Rephrase everything naturally. Never quote verbatim. If something isn't covered here, say honestly: "I don't have that detail right now — let me get that for you" or offer to connect them with someone.

${knowledgeItems.length > 0 ? knowledgeItems.map(item => `${item.title}: ${item.content}`).join('\n\n') : 'No specific knowledge uploaded yet — answer from general context and be honest about limitations.'}
`;

    const sessionPromise = ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        // 0.6 gives natural response variation while staying on-topic.
        // Too low (0.3) makes every sentence sound patterned and robotic.
        temperature: 0.6,
        // enableAffectiveDialog: true lets the model detect emotion in the
        // caller's voice (frustration, confusion, warmth) and soften/adjust
        // delivery accordingly — the core of sounding human. The system prompt
        // already guards against theatrical overreaction.
        enableAffectiveDialog: true,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: resolveSelectedVoiceEngine(),
            },
          },
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            // LOW start sensitivity = don't trigger on background noise
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            // HIGH end sensitivity = pick up the baton quickly when caller stops,
            // like a real human would (~0.3s gap). LOW caused dead silence.
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          },
        },
        // Preview-only flags often trigger opaque WS 1011 on Gemini Live + ephemeral auth; omit until stable.
        ...(resumeHandle ? { sessionResumption: { handle: resumeHandle } } : {}),
        tools: [
          {
            functionDeclarations: [
              captureLeadDeclaration,
              scheduleAppointmentDeclaration,
              transferToHumanDeclaration,
            ],
          },
        ],
      },
      callbacks: {
        onopen: async () => {
          if (userEndedCallRef.current) return;
          liveRealtimeSendAllowedRef.current = false;
          try {
            const p = liveSessionPromiseRef.current;
            if (!p) return;
            const s = await p;
            if (userEndedCallRef.current) return;
            sessionRef.current = s;
            setIsConnected(true);

            // Send greeting trigger FIRST — model starts generating while mic sets up in parallel
            try {
              s.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: 'Hello' }] }],
                turnComplete: true,
              });
            } catch {}

            // Set up mic in the background — model is already working on its response
            setStatus('Connecting...');
            await startAudioCapture();
            if (userEndedCallRef.current) return;

            // Mic ready — open the audio send channel
            liveRealtimeSendAllowedRef.current = true;
            setIsConnecting(false);
            setStatus('Agent is listening...');
          } catch (e) {
            console.warn('VoiceAgent: onopen setup failed', e);
            liveRealtimeSendAllowedRef.current = false;
          }
        },
        onmessage: async (message) => {
          console.log('VoiceAgent: Received message', message);
          const resUpdate = message.sessionResumptionUpdate;
          if (resUpdate?.resumable && resUpdate.newHandle) {
            resumptionHandleRef.current = resUpdate.newHandle;
          }
          if (message.goAway?.timeLeft) {
            setStatus('Connection renewing…');
          }
          if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const pcmData = base64ToPcm(part.inlineData.data);
                  scheduleAudioChunk(pcmData);
                }
                if (part.text) {
                  setTranscript(prev => [...prev, { role: 'agent', text: part.text!, timestamp: new Date().toISOString() }]);
                }
              }
            }

            if ((message as any).clientContent?.turns) {
              for (const turn of (message as any).clientContent.turns) {
                for (const part of turn.parts) {
                  if (part.text) {
                    setTranscript(prev => [...prev, { role: 'user', text: part.text!, timestamp: new Date().toISOString() }]);
                  }
                }
              }
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                let result = {};
                if (call.name === 'captureLead') {
                  await BusinessService.captureLead(tenantRef.current, call.args as any);
                  result = { status: "Lead captured successfully" };
                } else if (call.name === 'scheduleAppointment') {
                  await BusinessService.scheduleAppointment(tenantRef.current, call.args as any);
                  result = { status: "Appointment scheduled successfully" };
                } else if (call.name === 'transferToHuman') {
                  setStatus('Transferring to human...');
                  result = { status: "Transfer initiated" };
                }
                
                const sTool = sessionRef.current;
                if (sTool && liveRealtimeSendAllowedRef.current && isGeminiLiveWebSocketOpen(sTool)) {
                  try {
                    sTool.sendToolResponse({
                      functionResponses: [{ name: call.name, response: result, id: call.id }],
                    });
                  } catch {
                    liveRealtimeSendAllowedRef.current = false;
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              // Stop all buffered audio immediately so the agent goes silent at once
              activeSourcesRef.current.forEach(source => {
                try { source.stop(0); } catch {}
              });
              activeSourcesRef.current.clear();
              if (playbackCtxRef.current) {
                nextPlaybackTimeRef.current = playbackCtxRef.current.currentTime;
              }
            }
          },
          onclose: (ev?: CloseEvent) => {
            const detail =
              ev != null && typeof ev.code === 'number'
                ? ` code=${ev.code} reason=${ev.reason || '(none)'} wasClean=${ev.wasClean}`
                : '';
            console.warn(`VoiceAgent: Connection closed.${detail}`);
            liveRealtimeSendAllowedRef.current = false;
            liveSessionPromiseRef.current = null;
            sessionRef.current = null;
            if (userEndedCallRef.current) {
              return;
            }
            void attemptReconnect();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            const errMsg = err.message?.toLowerCase() || '';
            if (errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('429')) {
              userEndedCallRef.current = true;
              setStatus('Quota exceeded. Please wait a moment and try again.');
              stopSession();
              return;
            }
            setStatus('Connection issue…');
          },
        },
      });

    liveSessionPromiseRef.current = sessionPromise;
    try {
      await sessionPromise;
      if (userEndedCallRef.current) {
        liveRealtimeSendAllowedRef.current = false;
        sessionRef.current?.close();
        sessionRef.current = null;
        liveSessionPromiseRef.current = null;
      }
    } catch (e) {
      liveRealtimeSendAllowedRef.current = false;
      liveSessionPromiseRef.current = null;
      sessionRef.current = null;
      throw e;
    }
  }

  async function attemptReconnect() {
    if (userEndedCallRef.current || isReconnectingRef.current) return;
    const handle = resumptionHandleRef.current;
    if (!handle) {
      userEndedCallRef.current = true;
      stopSession();
      setStatus('Connection lost');
      return;
    }

    isReconnectingRef.current = true;
    setStatus('Reconnecting…');
    setIsConnecting(true);

    while (reconnectAttemptsRef.current < MAX_LIVE_RECONNECT_ATTEMPTS && !userEndedCallRef.current) {
      reconnectAttemptsRef.current += 1;
      await new Promise((r) => setTimeout(r, Math.min(800 * reconnectAttemptsRef.current, 4000)));
      try {
        await connectLive({
          resumeHandle: resumptionHandleRef.current ?? handle,
          fromReconnect: true,
        });
        reconnectAttemptsRef.current = 0;
        setStatus('Agent is listening...');
        isReconnectingRef.current = false;
        setIsConnecting(false);
        return;
      } catch (e) {
        console.error('Reconnect failed:', e);
      }
    }

    isReconnectingRef.current = false;
    setIsConnecting(false);
    userEndedCallRef.current = true;
    stopSession();
    setStatus('Connection lost — please start again.');
  }

  const startSession = async () => {
    userEndedCallRef.current = false;
    callStartTimeRef.current = Date.now();
    resumptionHandleRef.current = null;
    reconnectAttemptsRef.current = 0;
    try {
      await connectLive({});
    } catch (error) {
      console.error('Failed to start session:', error);
      setIsConnecting(false);
      setStatus('Connection failed');
    }
  };

  const stopSession = async () => {
    userEndedCallRef.current = true;
    liveRealtimeSendAllowedRef.current = false;
    resumptionHandleRef.current = null;
    reconnectAttemptsRef.current = 0;
    liveSessionPromiseRef.current = null;

    const durationSeconds = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0;
    callStartTimeRef.current = null;

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Stop all active audio sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;

    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    stopAudioCapture();
    setIsConnected(false);
    setIsConnecting(false);
    setStatus('Call ended');

    const snap = transcriptSnapshotRef.current;
    const t = tenantRef.current;
    if (snap.length > 0 && t) {
      const transcriptId = await BusinessService.saveTranscript(t, snap, durationSeconds);
      if (durationSeconds > 0 && transcriptId) {
        void BusinessService.logVoiceUsage(t, transcriptId, durationSeconds);
      }
    }
  };

  const startAudioCapture = async () => {
    console.log('VoiceAgent: startAudioCapture called');
    try {
      if (isCapturingRef.current && audioContextRef.current && workletNodeRef.current) {
        console.log('VoiceAgent: Audio capture already active');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation: true,
        },
      });
      console.log('VoiceAgent: Microphone access granted');

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Inline worklet as Blob URL — avoids Vite production bundling issues with AudioWorkletGlobalScope
      const workletCode = `
        class GeminiCaptureProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (!input || !input.length) return true;
            const channelData = input[0];
            const n = channelData.length;
            const pcm = new Int16Array(n);
            for (let i = 0; i < n; i++) {
              const s = Math.max(-1, Math.min(1, channelData[i]));
              pcm[i] = (s < 0 ? s * 0x8000 : s * 0x7fff) | 0;
            }
            this.port.postMessage(pcm.buffer, [pcm.buffer]);
            return true;
          }
        }
        registerProcessor('gemini-capture', GeminiCaptureProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const workletNode = new AudioWorkletNode(audioContext, 'gemini-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
        if (isMuted || !isCapturingRef.current || !liveRealtimeSendAllowedRef.current) return;
        const s = sessionRef.current;
        if (!s || !isGeminiLiveWebSocketOpen(s)) {
          if (s) liveRealtimeSendAllowedRef.current = false;
          return;
        }
        const pcmData = new Int16Array(ev.data);
        const base64Data = pcmToBase64(pcmData);
        try {
          s.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch {
          liveRealtimeSendAllowedRef.current = false;
        }
      };

      sourceRef.current = audioContext.createMediaStreamSource(stream);

      micGainNodeRef.current = audioContext.createGain();
      micGainNodeRef.current.gain.value = micGain * 1.2;

      sourceRef.current.connect(micGainNodeRef.current);
      micGainNodeRef.current.connect(workletNode);

      isCapturingRef.current = true;
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopAudioCapture = () => {
    isCapturingRef.current = false;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    micGainNodeRef.current = null;
  };

  const scheduleAudioChunk = (pcmData: Int16Array) => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: GEMINI_LIVE_OUTPUT_SAMPLE_RATE });
      const setupCtx = playbackCtxRef.current;
      const t = setupCtx.currentTime;
      const useSweetChain = resolveSelectedVoiceEngine() === 'Sulafat';

      playbackGainNodeRef.current = setupCtx.createGain();
      playbackGainNodeRef.current.gain.setValueAtTime(volume, t);
      playbackGainNodeRef.current.connect(setupCtx.destination);

      if (useSweetChain) {
        // Light warmth + melodic presence for Sulafat — Indian playback-singer sweetness without heavy processing.
        const warmth = setupCtx.createBiquadFilter();
        warmth.type = 'peaking';
        warmth.frequency.setValueAtTime(320, t);
        warmth.Q.setValueAtTime(0.85, t);
        warmth.gain.setValueAtTime(1.5, t);

        const melody = setupCtx.createBiquadFilter();
        melody.type = 'peaking';
        melody.frequency.setValueAtTime(2100, t);
        melody.Q.setValueAtTime(1.0, t);
        melody.gain.setValueAtTime(1.5, t);

        warmth.connect(melody);
        melody.connect(playbackGainNodeRef.current);
        (setupCtx as { _entryNode?: AudioNode })._entryNode = warmth;
      } else {
        (setupCtx as { _entryNode?: AudioNode })._entryNode = undefined;
      }

      nextPlaybackTimeRef.current = setupCtx.currentTime + 0.02;
    }

    const ctx = playbackCtxRef.current;
    const buffer = ctx.createBuffer(1, pcmData.length, GEMINI_LIVE_OUTPUT_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i]! / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    let startTime = nextPlaybackTimeRef.current;
    if (startTime < ctx.currentTime) {
      startTime = ctx.currentTime + 0.03;
    }

    const entryNode = (ctx as { _entryNode?: AudioNode })._entryNode;
    source.connect(entryNode ?? playbackGainNodeRef.current ?? ctx.destination);
    source.start(startTime);
    activeSourcesRef.current.add(source);

    const duration = pcmData.length / GEMINI_LIVE_OUTPUT_SAMPLE_RATE;
    nextPlaybackTimeRef.current = startTime + duration;

    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const base64ToPcm = (base64: string): Int16Array => {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return new Int16Array(buffer);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-slate-200/60 max-w-2xl mx-auto relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />
      
      <div className="text-center space-y-2 relative z-10">
        <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900">Voicera</h2>
        <p className={cn("text-sm font-medium px-3 py-1 rounded-full inline-block", 
          isConnected ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50" : "bg-slate-100 text-slate-500 border border-slate-200/50"
        )}>
          {status}
        </p>
      </div>

      <div className={cn("relative z-10", isConnected ? "mb-32" : "")}>
        <motion.div
          animate={isConnected ? {
            scale: [1, 1.05, 1],
            boxShadow: [
              "0 0 0 0 rgba(99, 102, 241, 0.4)",
              "0 0 0 20px rgba(99, 102, 241, 0)",
              "0 0 0 0 rgba(99, 102, 241, 0)"
            ]
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className={cn(
            "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500",
            isConnected ? "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-300/50" : "bg-slate-100 border-2 border-slate-200/50"
          )}
        >
          {isConnecting ? (
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
          ) : isConnected ? (
            <Volume2 className="w-20 h-20 text-white" />
          ) : (
            <Bot className="w-20 h-20 text-slate-400" />
          )}
        </motion.div>
        
        {isConnected && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center w-full max-w-xs z-50">
            <button
              onClick={() => setShowControls(!showControls)}
              className="flex items-center space-x-2 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg shadow-slate-200/50 border border-slate-200/60 text-slate-600 hover:text-indigo-600 transition-colors text-sm font-medium z-10"
            >
              <Settings2 size={16} />
              <span>Audio Controls</span>
              {showControls ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -20, height: 0 }}
                  className="flex flex-col items-center w-full overflow-visible pt-2"
                >
                  <div className="flex flex-col space-y-3 bg-white/95 backdrop-blur-xl p-4 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 w-full relative z-0">
                    <div className="flex items-center space-x-3 w-full">
                      <Volume2 size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-3 w-full">
                      <Mic size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={micGain}
                        onChange={(e) => setMicGain(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                      <span className="text-[10px] font-bold text-slate-400 w-6 text-right shrink-0">{micGain.toFixed(1)}x</span>
                    </div>

                    <div className="flex items-center justify-end w-full space-x-2 pt-1 border-t border-slate-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setNoiseSuppression(!noiseSuppression)}
                          title="Toggle Noise Suppression"
                          className={cn(
                            "p-2 rounded-full transition-all border",
                            noiseSuppression ? "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-200" : "bg-white text-slate-400 hover:bg-slate-50 border-slate-200/60"
                          )}
                        >
                          <AudioLines size={16} />
                        </button>
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className={cn(
                            "p-2 rounded-full transition-all border",
                            isMuted ? "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200/60"
                          )}
                        >
                          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="w-full relative z-10">
        <div className="flex flex-col space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Voice</span>
          <div className="flex flex-wrap gap-2">
            {BEAUTIFUL_VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={isConnected}
                onClick={() => {
                  voiceManuallySetRef.current = true;
                  setVoiceName(v.id);
                }}
                title={v.description}
                className={cn(
                  "flex flex-col items-start gap-0.5 px-3 py-2 rounded-2xl text-left transition-all border",
                  voiceName === v.id
                    ? "bg-violet-600 text-white border-violet-700 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                  isConnected && "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="text-xs font-semibold leading-none">{v.label}</span>
                <span className={cn(
                  "text-[10px] leading-tight",
                  voiceName === v.id ? "text-violet-100" : "text-slate-400"
                )}>
                  {v.description}
                </span>
              </button>
            ))}
          </div>
          {isConnected && (
            <p className="text-[10px] text-slate-400">End the call to change voice</p>
          )}
        </div>
      </div>

      <div className="w-full space-y-4 relative z-10">
        {!isConnected ? (
          <button
            onClick={startSession}
            disabled={isConnecting}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 group"
          >
            {isConnecting ? <Loader2 className="animate-spin" /> : <Mic className="group-hover:scale-110 transition-transform" />}
            <span>Start Conversation</span>
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="w-full py-4 bg-white border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 text-rose-600 rounded-2xl font-semibold text-lg shadow-lg shadow-rose-100/50 transition-all flex items-center justify-center space-x-2 mt-12"
          >
            <PhoneOff />
            <span>End Call</span>
          </button>
        )}
      </div>

      {!isConnected && !isConnecting && transcript.length > 0 && !tenant && (
        <div className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-800 relative z-10 space-y-1">
          <p className="font-semibold">Sign in to save this conversation</p>
          <p className="text-indigo-600">Your lead and transcript were not saved — they require a workspace. Sign in to keep them.</p>
          <a
            href="/app"
            className="inline-block mt-2 rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Sign in / Create workspace →
          </a>
        </div>
      )}

      <div className="w-full h-56 overflow-y-auto bg-slate-50/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/60 relative z-10">
        <div className="space-y-4">
          {transcript.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 mt-8">
              <Bot size={24} className="opacity-50" />
              <p className="text-sm font-medium">Conversation transcript will appear here...</p>
            </div>
          )}
          {transcript.map((msg, i) => (
            <div key={i} className={cn("flex space-x-2", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm" 
                  : "bg-white text-slate-700 border border-slate-200/60 rounded-tl-sm shadow-sm"
              )}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}
