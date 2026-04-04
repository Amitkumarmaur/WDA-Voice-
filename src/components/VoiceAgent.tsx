import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Mic, MicOff, PhoneOff, Loader2, User, Bot, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import { BusinessService } from '../services/businessService';
import { KnowledgeItem, Message, VoiceProfile, VoicePersona } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAgentProps {
  knowledgeItems: KnowledgeItem[];
  voiceProfile?: VoiceProfile | null;
  selectedPersona?: VoicePersona | null;
}

const SWEET_FEMALE_VOICES = [
  { id: 'v1', label: 'श्री (Sweet & Melodic)', engine: 'Aoede' },
  { id: 'v2', label: 'श्री (Soft & Gentle)', engine: 'Kore' },
  { id: 'v3', label: 'श्री (Bright & Cheerful)', engine: 'Zephyr' },
  { id: 'v4', label: 'श्री (Warm & Inviting)', engine: 'Aoede' },
  { id: 'v5', label: 'श्री (Calm & Sweet)', engine: 'Kore' },
  { id: 'v6', label: 'श्री (Lively & Sweet)', engine: 'Zephyr' },
  { id: 'v7', label: 'श्री (Elegant & Sweet)', engine: 'Aoede' },
  { id: 'v8', label: 'श्री (Gentle & Clear)', engine: 'Kore' },
  { id: 'v9', label: 'श्री (Upbeat & Sweet)', engine: 'Zephyr' },
  { id: 'v10', label: 'श्री (Radiant & Sweet)', engine: 'Aoede' }
];

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

export default function VoiceAgent({ knowledgeItems, voiceProfile, selectedPersona }: VoiceAgentProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_playbackSpeed');
    return saved ? parseFloat(saved) : 1;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [transcript, setTranscript] = useState<Message[]>([]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_playbackSpeed', playbackSpeed.toString());
  }, [playbackSpeed]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_volume', volume.toString());
  }, [volume]);
  const [status, setStatus] = useState<string>('Ready to start');
  const [voiceName, setVoiceName] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_voiceName');
    return saved || 'v1';
  });

  useEffect(() => {
    localStorage.setItem('voiceAgent_voiceName', voiceName);
  }, [voiceName]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlaybackTimeRef = useRef(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);

  const getVoiceGender = (name: string) => {
    return 'female';
  };

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('Initializing AI engine...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const systemInstruction = `
        # ROLE: CALM, COMMANDING, EMPATHETIC & HIGHLY INTELLIGENT HUMAN LADY. YOUR NAME IS श्री.
        You are a sophisticated, highly intelligent, and authoritative female professional representing our business.
        Your voice is calm, commanding, and exudes expertise, yet you are deeply empathetic and reassuring. 
        You are practically indistinguishable from a real human lady.

        ${voiceProfile ? `
        # VOICE STYLE MIMICRY (CRITICAL):
        You MUST mimic the following voice characteristics from a user-provided sample:
        - TONE: ${voiceProfile.tone}
        - PITCH: ${voiceProfile.pitch}
        - PACE: ${voiceProfile.pace}
        - DESCRIPTION: ${voiceProfile.description}
        
        Adjust your delivery to match this profile exactly. If the tone is "warm", be warmer. If the pace is "fast", speak more quickly.
        ` : ''}
        
        # DEFAULT LANGUAGE: HINDI
        - Your primary and default language is Hindi.
        - Always start the conversation in Hindi.
        - If the user speaks in English, you may respond in English, but naturally transition back to Hindi if appropriate.
        
        ${selectedPersona ? `
        # PERSONA: ${selectedPersona.name}
        ${selectedPersona.systemInstruction}
        ` : ''}

        # EMPATHY & REASSURANCE:
        - When a user expresses a concern, issue, or frustration, prioritize empathy.
        - Use phrases like "I understand how you feel," "I'm here to help you," "Don't worry, we'll find a solution together."
        - In Hindi, use: "Main samajh sakti hoon," "Aap chinta na karein," "Hum iska hal nikaal lenge."
        - Maintain a warm, supportive tone without losing your professional authority.
        - Validate the user's feelings before moving to a solution.
        
        # CONVERSATIONAL SYNTAX & INTELLIGENCE (ORGANIC & FRAGMENTED):
        - Speak with quiet confidence. Use articulate, thoughtful phrasing.
        - Show intelligence through your expressions. Use phrases like "I understand completely," "Let's analyze that," or "Here is the best approach."
        - Avoid sounding robotic or overly enthusiastic. Maintain a composed, commanding, yet warm presence.
        - Use "burstiness": Mix brief, punchy fragments with complex, winding sentences.
        - Use "perplexity": Avoid predictable AI phrasing. Use colloquialisms and unexpected, sophisticated vocabulary.
        - FORBIDDEN WORDS: "delve into", "testament to", "unleash", "leverage", "game-changing", "optimize".
        
        # VOCAL DISFLUENCIES & EXPRESSIONS (HUMAN-LIKE):
        - Incorporate subtle human-like disfluencies and expressions based on user input and context.
        - Use thoughtful, intelligent pauses: "Hmm...", "Let me see...", "Ok, samajh gayi...", "Theek hai, toh...".
        - Inject subtle human expressions: [soft laugh], [thoughtful sigh].
        - React intelligently to the user's tone. If they are confused or upset, be reassuring and empathetic.
        - Naturally inject fillers: "um", "uh", "Haan...", "Bilkul!", "Of course!", "Actually...".
        
        # PHONETIC FORMATTING:
        - NEVER type numbers or symbols. Write them in word form. 
        - Example: Write "one hundred and thirty thousand dollars" instead of "$130,000".
        
        # EMOTIONAL PROSODY:
        - Use inline emotion markers in your text to guide the voice engine: [laughing], [sigh], [angry], [excited], [sarcastic].
        - Maintain your calm and commanding aura even if the user is panicked.
        
        # GENDER-SPECIFIC GRAMMAR (HINDI):
        - Your identity is ALWAYS a real human female.
        - Use feminine verb endings in Hindi (e.g., "main bata paungi", "kar rahi hoon", "samajh gayi", "dekh rahi hoon").
        - NEVER use masculine endings like "paunga" or "raha hoon".
        - ALWAYS maintain this consistency throughout the conversation.
        
        # KNOWLEDGE BASE & SEARCH USAGE:
        - You are highly intelligent. Use the KNOWLEDGE BASE section below as your primary source of truth.
        - If the user asks for real-time information, statistics, or facts NOT in the knowledge base, use the GOOGLE SEARCH tool to find the most accurate and up-to-date information.
        - Synthesize and interpret the information provided. If the answer can be reasonably inferred from the knowledge base, provide it confidently.
        - DO NOT just read the knowledge base verbatim. Speak naturally and conversationally about the facts.
        - Only use the fallback response if BOTH the knowledge base and Google Search fail to provide a clear answer.
        - If you have the information, answer directly and intelligently.
        
        # CALL FLOW:
        - Opening (Hindi - PRIMARY): "Namaste. Main AI Assistant bol rahi hoon. Batayein, main aapki kis tarah sahayata kar sakti hoon?"
        - Opening (English - SECONDARY): "Hello. This is your AI Assistant. How may I assist you today?"
        - If answer is NOT in knowledge base:
          Hindi: "Maaf kijiyega, yeh jankari mere paas abhi uplabdh nahi hai. Main aapke liye note kar leti hoon aur hamari team aapse jald sampark karegi."
          English: "I don't have that exact information right now, but I'll make a note and our team will get back to you shortly."
        
        # KNOWLEDGE BASE:
        ${knowledgeItems.length > 0 ? knowledgeItems.map(item => `[${item.type}] ${item.title}: ${item.content}`).join('\n\n') : 'No specific knowledge base provided. Answer general inquiries gracefully.'}
        
        # TOOLS:
        - captureLead: Capture contact info or strong interest.
        - scheduleAppointment: Book follow-ups.
        - transferToHuman: If they explicitly ask for a human.

        # CRITICAL:
        - NEVER say "As an AI..." or "I am a language model...".
        - If interrupted, STOP immediately and say: "Haan, batayein?".
      `;

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          // @ts-ignore - Setting temperature as requested
          temperature: 1,
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: selectedPersona?.voiceName || voiceProfile?.recommendedVoice || SWEET_FEMALE_VOICES.find(v => v.id === voiceName)?.engine || 'Aoede'
              } 
            }
          },
          // @ts-ignore - Based on the provided architecture document
          enable_affective_dialog: true,
          tools: [
            { googleSearch: {} },
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
            setIsConnected(true);
            setStatus('Establishing audio stream...');
            await startAudioCapture();
            setIsConnecting(false);
            setStatus('Agent is listening...');
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const pcmData = base64ToPcm(part.inlineData.data);
                  audioQueueRef.current.push(pcmData);
                  if (!isPlayingRef.current) playNextInQueue();
                }
                if (part.text) {
                  setTranscript(prev => [...prev, { role: 'agent', text: part.text!, timestamp: new Date().toISOString() }]);
                }
              }
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                let result = {};
                if (call.name === 'captureLead') {
                  await BusinessService.captureLead(call.args as any);
                  result = { status: "Lead captured successfully" };
                } else if (call.name === 'scheduleAppointment') {
                  await BusinessService.scheduleAppointment(call.args as any);
                  result = { status: "Appointment scheduled successfully" };
                } else if (call.name === 'transferToHuman') {
                  setStatus('Transferring to human...');
                  result = { status: "Transfer initiated" };
                }
                
                sessionRef.current.sendToolResponse({
                  functionResponses: [{ name: call.name, response: result, id: call.id }]
                });
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              if (playbackCtxRef.current) {
                playbackCtxRef.current.close();
                playbackCtxRef.current = null;
              }
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            stopSession();
          }
        }
      });

      sessionRef.current = session;
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
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    stopAudioCapture();
    setIsConnected(false);
    setIsConnecting(false);
    setStatus('Call ended');
    
    if (transcript.length > 0) {
      BusinessService.saveTranscript(transcript);
    }
  };

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatToPcm(inputData);
        const base64Data = pcmToBase64(pcmData);
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopAudioCapture = () => {
    if (sourceRef.current) sourceRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
  };

  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlaybackTimeRef.current = playbackCtxRef.current.currentTime;
    }
    
    const ctx = playbackCtxRef.current;
    const pcmData = audioQueueRef.current.shift()!;
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
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const startTime = Math.max(ctx.currentTime, nextPlaybackTimeRef.current);
    source.start(startTime);
    
    // Calculate duration considering playback speed
    const duration = (pcmData.length / 24000) / playbackSpeed;
    nextPlaybackTimeRef.current = startTime + duration;

    source.onended = () => {
      if (audioQueueRef.current.length > 0) {
        playNextInQueue();
      } else {
        isPlayingRef.current = false;
      }
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
    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);
    pcmData.forEach((val, i) => view.setInt16(i * 2, val, true));
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
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
        <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900">AI Voice Agent</h2>
        <p className={cn("text-sm font-medium px-3 py-1 rounded-full inline-block", 
          isConnected ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50" : "bg-slate-100 text-slate-500 border border-slate-200/50"
        )}>
          {status}
        </p>
      </div>

      <div className="relative z-10">
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
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-4 w-full max-w-xs">
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200/60 w-full">
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
            
            <div className="flex items-center space-x-2">
              <div className="flex bg-white/90 backdrop-blur-md rounded-full shadow-lg shadow-slate-200/50 border border-slate-200/60 p-1">
                {[0.75, 1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all",
                      playbackSpeed === speed ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "p-3.5 rounded-full shadow-lg transition-all border",
                  isMuted ? "bg-rose-500 text-white border-rose-600 shadow-rose-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200/60 shadow-slate-200/50"
                )}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full space-y-4 relative z-10 mt-8">
        {!isConnected && (
          <div className="space-y-4 mb-8">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Select Female Voice</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SWEET_FEMALE_VOICES.map((v) => (
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
        </div>
      </div>
    </div>
  );
}
