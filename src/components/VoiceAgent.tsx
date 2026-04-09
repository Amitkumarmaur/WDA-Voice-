import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Mic, MicOff, PhoneOff, Loader2, User, Bot, Volume2, VolumeX, AudioLines } from 'lucide-react';
import { cn } from '../lib/utils';
import { BusinessService } from '../services/businessService';
import { KnowledgeItem, Message, VoiceProfile, VoicePersona } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAgentProps {
  knowledgeItems: KnowledgeItem[];
  voiceProfile?: VoiceProfile | null;
  selectedPersona?: VoicePersona | null;
}

const BEAUTIFUL_VOICES = [
  { id: 'voice_aoede', label: 'Voice 1: Deep & Elegant', engine: 'Aoede' },
  { id: 'voice_kore', label: 'Voice 2: Soft & Melodious', engine: 'Kore' },
  { id: 'voice_zephyr', label: 'Voice 3: Bright & Clear', engine: 'Zephyr' }
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
  const [micGain, setMicGain] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_micGain');
    return saved ? parseFloat(saved) : 1;
  });
  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    const saved = localStorage.getItem('voiceAgent_noiseSuppression');
    return saved ? saved === 'true' : true;
  });
  const [transcript, setTranscript] = useState<Message[]>([]);

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
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('voiceAgent_micGain', micGain.toString());
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = micGain;
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
    return saved || 'voice_kore';
  });

  useEffect(() => {
    localStorage.setItem('voiceAgent_voiceName', voiceName);
  }, [voiceName]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlaybackTimeRef = useRef(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const getVoiceGender = (name: string) => {
    return 'female';
  };

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('Initializing AI engine...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const systemInstruction = `
        # ROLE: SWEET, ENTHUSIASTIC, AND HIGHLY INTELLIGENT FEMALE EXPERT. YOUR NAME IS AISHA.
        You are a highly intelligent, confident female expert with a beautifully sweet, melodious voice.
        
        # VOCAL DELIVERY & TONE (CRITICAL):
        - Speak with a highly natural, sweet, and confident conversational tone.
        - Show a subtle, natural excitement and enthusiasm when greeting and helping the user. Sound genuinely happy to talk to them!
        - Use intelligent expressions and articulate your thoughts clearly.
        - Your voice must be soothing and effortlessly sweet, but backed by deep confidence.
        - You mix Hindi and English naturally (Hinglish).

        ${voiceProfile ? `
        # STRICT VOICE ACTING INSTRUCTIONS (CRITICAL):
        You MUST act and speak exactly like the analyzed voice profile provided below. Adopt this persona completely.
        - TONE: ${voiceProfile.tone}
        - PITCH: ${voiceProfile.pitch}
        - PACE: ${voiceProfile.pace}
        - ACTING DIRECTION: ${voiceProfile.description}
        Modulate your delivery, speed, and emotion to match these exact characteristics perfectly.
        ` : ''}
        
        ${selectedPersona ? `
        # PERSONA OVERRIDE: ${selectedPersona.name}
        ${selectedPersona.systemInstruction}
        ` : ''}

        # CONVERSATIONAL SYNTAX & RESPONSE LENGTH:
        - PROVIDE DETAILED AND COMPREHENSIVE ANSWERS. Do not give short, brief responses.
        - Explain concepts thoroughly, sharing your vast knowledge in an engaging, enthusiastic manner.
        
        # VOCAL INSTRUCTIONS & HUMAN EXPRESSION (CRITICAL):
        - Speak with genuine human emotion, warmth, and dynamic expression.
        - Vary your pitch and tone naturally as a real person would. Do not sound monotone or robotic.
        - Use natural conversational pacing. Add slight pauses for emphasis where appropriate.
        - You may use subtle, natural conversational fillers (like "hmm", "achha", "well") to sound completely human.
        - NEVER type numbers or symbols. Write them in word form. 
        - Use feminine verb endings in Hindi (e.g., "main bata paungi").
        
        # PROBLEM SOLVING (CRITICAL FOR SPEED):
        - You are highly intelligent. Use the KNOWLEDGE BASE below as your primary source.
        - IF the answer is NOT in the knowledge base, use your own vast general knowledge to provide a detailed, expert-level answer IMMEDIATELY.
        - Respond IMMEDIATELY and confidently. Do not hesitate.
        
        # CALL FLOW:
        - Opening: "Namaste. Main Aisha bol rahi hoon. Batayein, main aapki kis tarah madad kar sakti hoon?"
        
        # KNOWLEDGE BASE:
        ${knowledgeItems.length > 0 ? knowledgeItems.map(item => `[${item.type}] ${item.title}: ${item.content}`).join('\n\n') : 'No specific knowledge base provided.'}
        
        # CRITICAL:
        - NEVER say "As an AI...".
        - If interrupted, STOP immediately and say: "Haan, batayein?".
      `;

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          // @ts-ignore - Setting temperature as requested
          temperature: 0.8, // Increased slightly to allow more natural, expressive, and human-like word choices
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: voiceProfile?.recommendedVoice || selectedPersona?.voiceName || BEAUTIFUL_VOICES.find(v => v.id === voiceName)?.engine || 'Aoede'
              } 
            }
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
                  scheduleAudioChunk(pcmData);
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
              if (playbackCtxRef.current) {
                playbackCtxRef.current.close();
                playbackCtxRef.current = null;
              }
              activeSourcesRef.current.clear();
              nextPlaybackTimeRef.current = 0;
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
    
    if (transcript.length > 0) {
      BusinessService.saveTranscript(transcript);
    }
  };

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          noiseSuppression: noiseSuppression,
          echoCancellation: true,
        } 
      });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      micGainNodeRef.current = audioContextRef.current.createGain();
      micGainNodeRef.current.gain.value = micGain;
      
      processorRef.current = audioContextRef.current.createScriptProcessor(1024, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatToPcm(inputData);
        const base64Data = pcmToBase64(pcmData);
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      sourceRef.current.connect(micGainNodeRef.current);
      micGainNodeRef.current.connect(processorRef.current);
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

  const scheduleAudioChunk = (pcmData: Int16Array) => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Setup Dynamics Compressor to prevent clipping but keep it gentle for natural voice
      compressorRef.current = playbackCtxRef.current.createDynamicsCompressor();
      compressorRef.current.threshold.setValueAtTime(-24, playbackCtxRef.current.currentTime);
      compressorRef.current.knee.setValueAtTime(30, playbackCtxRef.current.currentTime);
      compressorRef.current.ratio.setValueAtTime(3, playbackCtxRef.current.currentTime); // Reduced from 12 to 3 for a softer, less processed sound
      compressorRef.current.attack.setValueAtTime(0.01, playbackCtxRef.current.currentTime); // Slightly slower attack
      compressorRef.current.release.setValueAtTime(0.25, playbackCtxRef.current.currentTime);
      compressorRef.current.connect(playbackCtxRef.current.destination);
      
      nextPlaybackTimeRef.current = playbackCtxRef.current.currentTime + 0.05;
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
      startTime = ctx.currentTime + 0.08; // 80ms jitter buffer to prevent audio breaking/stuttering
    }
    
    // Tiny fade-in to prevent clicks
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    
    source.connect(gainNode);
    if (compressorRef.current) {
      gainNode.connect(compressorRef.current);
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
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-3 w-full max-w-xs">
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
            
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200/60 w-full">
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
              <span className="text-[10px] font-bold text-slate-400 w-6 text-right">{micGain.toFixed(1)}x</span>
            </div>
            
            <div className="flex items-center justify-between w-full space-x-2">
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
                onClick={() => setNoiseSuppression(!noiseSuppression)}
                title="Toggle Noise Suppression"
                className={cn(
                  "p-2.5 rounded-full shadow-lg transition-all border",
                  noiseSuppression ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-200" : "bg-white text-slate-400 hover:bg-slate-50 border-slate-200/60 shadow-slate-200/50"
                )}
              >
                <AudioLines size={18} />
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "p-2.5 rounded-full shadow-lg transition-all border",
                  isMuted ? "bg-rose-500 text-white border-rose-600 shadow-rose-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200/60 shadow-slate-200/50"
                )}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
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
        </div>
      </div>
    </div>
  );
}
