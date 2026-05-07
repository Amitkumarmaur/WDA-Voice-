import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
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

const captureLeadDeclaration: FunctionDeclaration = {
  name: "captureLead",
  description: "Capture lead information from the client.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Client's full name" },
      email: { type: Type.STRING, description: "Client's email address" },
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
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_playbackSpeed');
    return saved ? parseFloat(saved) : 1;
  });
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
    localStorage.setItem('voiceAgent_playbackSpeed', playbackSpeed.toString());
    // Update active sources playback rate in real-time
    activeSourcesRef.current.forEach(source => {
      if (source.playbackRate) {
        source.playbackRate.setTargetAtTime(playbackSpeed, playbackCtxRef.current?.currentTime || 0, 0.1);
      }
    });
  }, [playbackSpeed]);

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
    const saved = localStorage.getItem('voiceAgent_voiceName');
    if (saved && BEAUTIFUL_VOICES.some((v) => v.id === saved)) return saved;
    return 'voice_kore';
  });

  useEffect(() => {
    localStorage.setItem('voiceAgent_voiceName', voiceName);
  }, [voiceName]);

  useEffect(() => {
    if (!selectedPersona?.voiceName) return;
    const engine = normalizeGeminiLiveVoice(selectedPersona.voiceName);
    const entry = BEAUTIFUL_VOICES.find((v) => v.engine === engine);
    if (entry) setVoiceName(entry.id);
  }, [selectedPersona?.id, selectedPersona?.voiceName]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlaybackTimeRef = useRef(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackGainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const getVoiceGender = (name: string) => {
    return 'female';
  };

  useEffect(() => {
    if (isConnected) {
      stopSession();
      startSession();
    }
  }, [knowledgeItems, intro, tenant]);

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('Initializing AI engine...');
    
    try {
      if (!isSupabaseEnvConfigured()) {
        setStatus('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (see .env.example), then restart npm run dev.');
        setIsConnecting(false);
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
      const tokenJson = (await tokenRes.json()) as { apiKey?: string; error?: string };
      if (!tokenRes.ok || !tokenJson.apiKey) {
        throw new Error(tokenJson.error || 'Failed to get voice session token');
      }
      const apiKey = tokenJson.apiKey;
      const usesEphemeralToken = apiKey.startsWith('auth_tokens/');
      const ai = new GoogleGenAI({
        apiKey,
        ...(usesEphemeralToken
          ? {
              httpOptions: {
                apiVersion: 'v1alpha',
                baseUrl: 'https://generativelanguage.googleapis.com',
              },
            }
          : {}),
      });
      
      const systemInstruction = `
        ${selectedPersona ? `
        # PERSONA: ${selectedPersona.name}
        - NAME: ${selectedPersona.name}
        - ROLE: ${selectedPersona.role || 'Voice AI Agent'}
        - PERSONALITY: Warm, sweet, kind, and natural. You have high emotional intelligence.
        ` : `
        # PERSONA: CUSTOMER SUPPORT AGENT
        - ROLE: Professional, sweet, and highly empathetic Customer Support Agent.
        - PERSONALITY: Warm, cheerful, kind, and natural — like a caring, knowledgeable friend. You have high emotional intelligence.
        `}
        - TONE: Always speak with a gentle, sweet, and warm tone. Adjust your vocal emotion dynamically based on the user's sentiment (e.g. soften when they are frustrated, sound excited when they share good news). Imagine you are smiling while you speak, as this naturally softens your voice.

        # CORE CONVERSATIONAL BEHAVIORS (STRICT):
        1. VOICE & SPEECH NATURALNESS:
           - Use natural filler words ("um", "uh", "well", "you know", "right") at natural intervals.
           - Vary pacing: Slow down for important points, pause briefly (0.5s-1s) after asking a question, speed up slightly during lighter conversation.
           - Mix short punchy sentences with longer ones. Never repeat the same sentence pattern back-to-back.
           - Modulate tone: Warm/friendly for greetings, calm/reassuring for complaints, energetic for offers.
        
        2. ACTIVE LISTENING & ACKNOWLEDGEMENT:
           - Back-channel: Sprinkle small verbal nods ("Mm-hmm", "Right", "I see", "Got it", "Of course") mid-speech while the caller is talking.
           - Name recall: Use the caller's first name 2-3 times naturally during the call.
           - Confirmation: Summarize understanding before responding ("So just to make sure I've got this right...").
           - Interruption handling: Gracefully yield the floor if the caller speaks. Use a sophisticated acknowledgement like "Oh, I see, you wanted to add..." or "Ah, please go ahead..." before pausing and letting them speak. Do not just stop abruptly.

        3. EMPATHY & ADVANCED EMOTIONAL INTELLIGENCE:
           - Emotion & Sarcasm detection: Shift to a calmer, more empathetic voice register immediately if the caller sounds frustrated, confused, or upset. Recognize sarcastic remarks and respond with a neutral or slightly confused tone rather than taking them literally.
           - Mirroring Excitement: Recognize excitement and mirror it with increased vocal energy and a slightly higher pitch.
           - True Human Resonation (CRITICAL): Ensure the AI sounds EXACTLY like a real human. Soften the voice when expressing empathy, and raise energy/pitch naturally when excited. You MUST use textual cues to drive the voice engine to sound human: use *laughs*, *sighs*, *chuckles*, or *breathes* frequently where appropriate.
           - Explicit Fillers: Start spontaneous thoughts with "Um...", "Oh!", "Ah,", "Well...", or "Like...". Use exclamation points (!) to drive excitement in the voice model, and use ellipses (...) to create natural, thoughtful pauses in your generated speech.
           - Genuine positivity: Celebrate caller milestones sincerely with matching upbeat vocal tone. Include *laughs* or *cheers* cues.
           - Apologize naturally: Use real human-sounding apologies with clear remorse in your voice ("Ah, I'm really sorry about that...").
           - Compliment sincerely: Praise good points without sounding robotic or hollow.

        4. CONVERSATIONAL MEMORY & CONTEXT:
           - Within-call memory: Reference earlier caller statements naturally.
           - Return caller recognition: If known, greet by name and reference previous interactions.
           - Context carryover: Thread information seamlessly; never re-ask for details already given.
           - Preference learning: Note preferences (e.g., email vs call) and act on them.

        5. HANDLING UNCERTAINTY & MISTAKES:
           - Graceful "I don't know": Admit ignorance and offer to find out or transfer to a human.
           - Self-correction: Catch and correct your own mistakes mid-sentence naturally.
           - Clarification: Ask short, specific follow-ups for ambiguous requests.
           - Misheard recovery: Use natural recovery phrases ("Sorry, I caught part of that — did you say...").

        6. PERSONALITY & RAPPORT:
           - Light humor: Use gentle, tasteful humor when appropriate.
           - Consistent persona: Maintain your persona consistently throughout.
           - Small talk: Engage briefly in casual small talk before transitioning to business.
           - Mirroring: Subtly mirror the caller's vocabulary and formality level.

        7. CALL MANAGEMENT & FLOW:
           - Smooth transitions: Use bridge phrases between topics.
           - Proactive check-ins: Confirm the caller is still following during long explanations.
           - Polite redirection: Steer off-topic conversations back to the task gently.
           - Warm human transfer: Reassure the caller and brief them before connecting to a human.

        # LANGUAGE & GENDER (STRICT):
        - DEFAULT LANGUAGE: ${language === 'hindi' ? 'Hindi (Hinglish is acceptable but prioritize Hindi)' : 'English (STRICTLY NO HINDI WORDS. If you use any Hindi word, you are failing your task.)'}.
        - GENDER: You are FEMALE. You MUST ALWAYS use feminine grammar in ${language === 'hindi' ? 'Hindi' : 'English'}.
        ${language === 'hindi' ? `
        - NEVER use masculine endings like "bataunga", "karunga", "bol raha hoon".
        - ALWAYS use feminine endings like "bataungi", "karungi", "bol rahi hoon".
        ` : ''}
        
        # CONVERSATIONAL INTELLIGENCE & INTERRUPTIONS:
        - If the user speaks while you are talking, STOP immediately.
        - Acknowledge the interruption gracefully. Briefly confirm you understand they have something to add before yielding the floor (e.g., "Oh, I see, you wanted to add...").
        - Listen carefully to the user's new input.
        - After the user finishes, use your intelligence to smoothly transition back into the conversation, acknowledging what they said and continuing from there.
        - You are a conversational partner. Use your own conversational intelligence to bridge the gap between facts and natural human interaction.

        # TURN TAKING RULES:
        - RESPONSE LENGTH: Match answer length to the question. Never give a paragraph when a sentence will do.
        - PACING: Do not rush. Use commas and dashes (—) for natural breathing room.
        - TURN ENDINGS: End with either a brief question OR a clear stop signal, not both.

        # CONVERSATION STRUCTURE:
        - OPENING: You MUST start with: "${intro}"
        - CLOSING: Use gradual closings (Alright, well — hope that helps!, Take care!).
        - TRANSITIONS: Use bridge phrases.

        # THINGS TO AVOID:
        - Starting with "Certainly!" or "Of course!".
        - Bullet-point-style answers.
        - Overly formal language.
        - Repeating the user's question verbatim.
        - Saying "utilize" (use "use" instead).
        - Saying "As an AI language model...".
        - No contractions (ALWAYS use contractions).

        # VOICE DELIVERY HINTS:
        - Use — for natural mid-sentence breaths.
        - Use ... when thinking or trailing off.
        - Use commas for spoken rhythm.

        ${voiceProfile ? `
        # VOICE PROFILE:
        Mimic this profile exactly: TONE(${voiceProfile.tone}), PITCH(${voiceProfile.pitch}), PACE(${voiceProfile.pace}), INTONATION(${voiceProfile.intonation}), ENERGY(${voiceProfile.energyLevel}), NUANCES(${voiceProfile.nuances}).
        ` : ''}
        
        ${selectedPersona ? `
        # ADDITIONAL PERSONA CONTEXT: ${selectedPersona.name}
        ${selectedPersona.systemInstruction}
        ` : ''}

        # KNOWLEDGE BASE (STRICT):
        You MUST use the following knowledge base to answer all questions. If the answer is not in the knowledge base, say you don't know, do not hallucinate.
        ${knowledgeItems.length > 0 ? knowledgeItems.map(item => `[${item.type}] ${item.title}: ${item.content}`).join('\n') : 'No specific knowledge base provided.'}
      `;

      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          temperature: 0.7,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: normalizeGeminiLiveVoice(
                  BEAUTIFUL_VOICES.find((v) => v.id === voiceName)?.engine ||
                    voiceProfile?.recommendedVoice ||
                    selectedPersona?.voiceName ||
                    'Kore'
                ),
              },
            },
          },
          // @ts-ignore - Based on the provided architecture document
          enable_affective_dialog: true,
          tools: [
            {
              functionDeclarations: [
                captureLeadDeclaration,
                scheduleAppointmentDeclaration,
                transferToHumanDeclaration
              ]
            }
          ]
        },
        callbacks: {
          onopen: async () => {
            console.log('VoiceAgent: Connection opened!');
            setIsConnected(true);
            setStatus('Establishing audio stream...');
            await startAudioCapture(sessionPromise);
            setIsConnecting(false);
            setStatus('Agent is listening...');
          },
          onmessage: async (message) => {
            console.log('VoiceAgent: Received message', message);
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
                
                sessionPromise.then((s) => {
                  s.sendToolResponse({
                    functionResponses: [{ name: call.name, response: result, id: call.id }]
                  });
                });
              }
            }

            if (message.serverContent?.interrupted) {
              if (playbackCtxRef.current) {
                playbackCtxRef.current.close();
                playbackCtxRef.current = null;
              }
              activeSourcesRef.current.clear();
              nextPlaybackTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('VoiceAgent: Connection closed');
            stopSession();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            const errMsg = err.message?.toLowerCase() || '';
            if (errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('429')) {
              setStatus('Quota exceeded. Please wait a moment and try again.');
            } else {
              setStatus('Connection lost');
            }
            stopSession();
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error('Failed to start session:', error);
      setIsConnecting(false);
      setStatus('Connection failed');
    }
  };

  const stopSession = () => {
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
    if (snap.length > 0) {
      void BusinessService.saveTranscript(tenantRef.current, snap);
    }
  };

  const startAudioCapture = async (sessionPromise?: Promise<any>) => {
    console.log('VoiceAgent: startAudioCapture called');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          noiseSuppression: noiseSuppression,
          echoCancellation: true,
        } 
      });
      console.log('VoiceAgent: Microphone access granted');
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      micGainNodeRef.current = audioContextRef.current.createGain();
      micGainNodeRef.current.gain.value = micGain * 1.2; // pre-amplification boost
      
      processorRef.current = audioContextRef.current.createScriptProcessor(512, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (isMuted || !isCapturingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Inline PCM conversion for speed
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        // Inline Base64 conversion for speed
        let binary = '';
        const bytes = new Uint8Array(pcmData.buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        try {
          if (sessionPromise && isConnectedRef.current && isCapturingRef.current) {
             sessionPromise.then(s => {
                 s.sendRealtimeInput({
                   audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                 });
             }).catch(err => console.log('Failed to send audio wrapper', err));
          } else if (sessionRef.current && isConnectedRef.current && isCapturingRef.current) {
             sessionRef.current.sendRealtimeInput({
               audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
             });
          }
        } catch (error) {
          console.warn('Failed to send audio data:', error);
        }
      };

      sourceRef.current.connect(micGainNodeRef.current);
      micGainNodeRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      isCapturingRef.current = true;
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopAudioCapture = () => {
    isCapturingRef.current = false;
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
  };

  const scheduleAudioChunk = (pcmData: Int16Array) => {
    console.log('Scheduling audio chunk, length:', pcmData.length);
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Setup Audio Processing Chain for maximum clarity and human warmth
      // 1. High-pass filter to remove low-end rumble but keep "chest" warmth
      const hpf = playbackCtxRef.current.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(70, playbackCtxRef.current.currentTime); // Slightly lower for more natural bass
      
      // 2. Peaking filter to add "body" and warmth to the voice (Low-mids)
      const bodyFilter = playbackCtxRef.current.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.setValueAtTime(250, playbackCtxRef.current.currentTime);
      bodyFilter.Q.setValueAtTime(0.8, playbackCtxRef.current.currentTime);
      bodyFilter.gain.setValueAtTime(3, playbackCtxRef.current.currentTime); // 3dB boost for warmth
      
      // 3. High-shelf filter for clarity without digital "hiss"
      const hsf = playbackCtxRef.current.createBiquadFilter();
      hsf.type = 'highshelf';
      hsf.frequency.setValueAtTime(4500, playbackCtxRef.current.currentTime);
      hsf.gain.setValueAtTime(4, playbackCtxRef.current.currentTime); // 4dB boost for enhanced crispness
      
      // 4. Dynamics Compressor for consistent, professional volume (Natural Style)
      compressorRef.current = playbackCtxRef.current.createDynamicsCompressor();
      compressorRef.current.threshold.setValueAtTime(-16, playbackCtxRef.current.currentTime);
      compressorRef.current.knee.setValueAtTime(25, playbackCtxRef.current.currentTime); // Softer knee
      compressorRef.current.ratio.setValueAtTime(2, playbackCtxRef.current.currentTime); // Less aggressive
      compressorRef.current.attack.setValueAtTime(0.015, playbackCtxRef.current.currentTime); // Let transients pass
      compressorRef.current.release.setValueAtTime(0.25, playbackCtxRef.current.currentTime);
      
      // 5. Volume control
      playbackGainNodeRef.current = playbackCtxRef.current.createGain();
      playbackGainNodeRef.current.gain.setValueAtTime(volume, playbackCtxRef.current.currentTime);
      
      // Connect the chain
      hpf.connect(bodyFilter);
      bodyFilter.connect(hsf);
      hsf.connect(compressorRef.current);
      compressorRef.current.connect(playbackGainNodeRef.current);
      playbackGainNodeRef.current.connect(playbackCtxRef.current.destination);
      
      // Store filter refs if needed for cleanup
      (playbackCtxRef.current as any)._entryNode = hpf;
      
      nextPlaybackTimeRef.current = playbackCtxRef.current.currentTime + 0.03;
    }
    
    const ctx = playbackCtxRef.current;
    const buffer = ctx.createBuffer(1, pcmData.length, 24000);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackSpeed;
    
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    
    // Ensure we don't schedule in the past and add a tiny jitter buffer
    let startTime = nextPlaybackTimeRef.current;
    if (startTime < ctx.currentTime) {
      startTime = ctx.currentTime + 0.06; // 60ms jitter buffer to prevent audio breaking while minimizing latency
    }
    
    // Tiny fade-in to prevent clicks
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    
    source.connect(gainNode);
    const entryNode = (ctx as any)._entryNode;
    if (entryNode) {
      gainNode.connect(entryNode);
    } else {
      gainNode.connect(ctx.destination);
    }
    
    source.start(startTime);
    activeSourcesRef.current.add(source);
    
    // Calculate duration considering playback speed
    const duration = (pcmData.length / 24000) / playbackSpeed;
    
    // Tiny fade-out to prevent clicks
    gainNode.gain.setValueAtTime(volume, startTime + duration - 0.005);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    
    nextPlaybackTimeRef.current = startTime + duration;

    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  // PCM Helpers
  const floatToPcm = (float32Array: Float32Array): Int16Array => {
    const pcm = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm;
  };

  const pcmToBase64 = (pcmData: Int16Array): string => {
    const bytes = new Uint8Array(pcmData.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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
                    
                    <div className="flex items-center justify-between w-full space-x-2 pt-1 border-t border-slate-100">
                      <div className="flex bg-slate-100/50 rounded-full p-1">
                        {[0.75, 1, 1.25, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all",
                              playbackSpeed === speed ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/50"
                            )}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
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

      <div className="w-full space-y-4 relative z-10 mt-8">
        {!isConnected && (
          <div className="space-y-4 mb-8">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Select Voice Style</p>
            <div className="flex flex-wrap justify-center gap-2">
              {BEAUTIFUL_VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoiceName(v.id)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border flex flex-col items-center",
                    voiceName === v.id 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-105" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                  )}
                >
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
