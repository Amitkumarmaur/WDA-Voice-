import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Gemini Live constants ────────────────────────────────────────────────────
const GEMINI_MODEL = "models/gemini-3.1-flash-live-preview";
const GEMINI_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

// ─── μ-law codec (Twilio sends/receives 8 kHz μ-law audio) ───────────────────

function mulawDecode(u: number): number {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exp = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let s = ((mantissa << 3) + 0x84) << exp;
  s -= 0x84;
  return sign ? -s : s;
}

function mulawEncode(sample: number): number {
  const BIAS = 0x84;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > 32767) sample = 32767;
  sample += BIAS;
  let exp = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exp > 0; exp--, mask >>= 1) {}
  const mantissa = (sample >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mantissa) & 0xff;
}

function mulawToLinear16(data: Uint8Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = mulawDecode(data[i]);
  return out;
}

function linear16ToMulaw(samples: Int16Array): Uint8Array {
  const out = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = mulawEncode(samples[i]);
  return out;
}

// 8 kHz → 16 kHz via linear interpolation (Gemini wants 16 kHz)
function upsample8to16(s: Int16Array): Int16Array {
  const out = new Int16Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    out[i * 2] = s[i];
    out[i * 2 + 1] = i + 1 < s.length ? ((s[i] + s[i + 1]) >> 1) : s[i];
  }
  return out;
}

// 24 kHz → 8 kHz by averaging every 3 samples (Gemini outputs 24 kHz)
function downsample24to8(s: Int16Array): Int16Array {
  const out = new Int16Array(Math.floor(s.length / 3));
  for (let i = 0; i < out.length; i++) {
    const a = s[i * 3] ?? 0;
    const b = s[i * 3 + 1] ?? 0;
    const c = s[i * 3 + 2] ?? 0;
    out[i] = ((a + b + c) / 3) | 0;
  }
  return out;
}

// ─── Base64 helpers ───────────────────────────────────────────────────────────

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToB64(arr: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function int16ToB64(arr: Int16Array): string {
  return uint8ToB64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function makeAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type OrgBundle = {
  organization_id: string;
  public_slug: string;
  knowledge_items: Array<{ title: string; content: string }>;
  agent_settings: { intro?: string; persona_id?: string; language?: string };
  voice_profile?: { recommended_voice?: string } | null;
};

async function loadOrgBundle(slug: string): Promise<OrgBundle | null> {
  const admin = makeAdmin();
  const { data, error } = await admin.rpc("get_public_agent_bundle", { p_slug: slug });
  if (error || !data) {
    console.error("loadOrgBundle:", error?.message);
    return null;
  }
  return data as OrgBundle;
}

async function checkQuota(orgId: string): Promise<boolean> {
  const admin = makeAdmin();
  const { data } = await admin
    .from("organizations")
    .select("monthly_voice_minutes_used, monthly_voice_minutes_limit")
    .eq("id", orgId)
    .single();
  if (!data) return false;
  return Number(data.monthly_voice_minutes_used) < Number(data.monthly_voice_minutes_limit);
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(bundle: OrgBundle): string {
  const lang = bundle.agent_settings.language === "hindi" ? "hindi" : "english";
  const intro =
    bundle.agent_settings.intro?.trim() ||
    "Hello! Thank you for calling. How can I help you today?";
  const kb =
    bundle.knowledge_items.length > 0
      ? bundle.knowledge_items.map((k) => `${k.title}: ${k.content}`).join("\n\n")
      : "No specific knowledge provided.";

  return `
# ROLE: Professional Voice AI Agent
- PERSONALITY: Warm, composed, and helpful — like a trusted senior advisor at a premium company.
- TONE: Even, conversational, grounded. Never theatrical, never sing-song.

# LANGUAGE:
${
    lang === "hindi"
      ? `- Speak formal Hindi only. Always use "aap". Feminine grammar throughout (bataungi, karungi, bol rahi hoon).
- BANNED casual words: accha, badiya, theek hai, yaar, are, matlab. Use: bilkul, zaroor, ji haan, nishchit roop se.`
      : `- English only. Use contractions always. No Hindi words whatsoever.`
  }

# OPENING LINE (say this EXACTLY at the start):
"${intro}"

# CONVERSATION RULES:
1. Keep answers short — match length to the question.
2. Use natural fillers: ${lang === "hindi" ? '"ji", "ji haan", "bilkul", "zaroor"' : '"um", "right", "I see", "got it"'}.
3. Acknowledge interruptions gracefully — stop and yield the floor.
4. Never read knowledge word-for-word — rephrase in your own voice.
5. Never bullet-point answers. Speak in short natural sentences.
6. Do NOT start with "Certainly!" or "Of course!".
7. Do NOT say "As an AI...".

# TOOLS:
- captureLead: use when you have the caller's name + any contact info.
- scheduleAppointment: use when they want to book a time.
- transferToHuman: use when they explicitly ask for a person.

# YOUR KNOWLEDGE:
${kb}
`;
}

// ─── TwiML ────────────────────────────────────────────────────────────────────

function twiML(streamUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
}

// ─── Deno.serve entry ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";

  // ── WebSocket upgrade — Twilio Media Stream bridge ──
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    if (!slug) return new Response("Missing slug param", { status: 400 });
    const { socket, response } = Deno.upgradeWebSocket(req);
    runBridge(socket, slug).catch((e) => {
      console.error("Bridge fatal:", e);
      try { socket.close(1011, "Bridge error"); } catch { /* ignore */ }
    });
    return response;
  }

  // ── POST — Twilio voice webhook ──
  if (req.method === "POST") {
    if (!slug) return new Response("Missing slug param", { status: 400 });
    // Build WebSocket URL from the incoming request URL
    const wsUrl = req.url.replace(/^http/, "ws");
    return new Response(twiML(wsUrl), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  return new Response("Voicera Twilio bridge — send POST or WS with ?slug=<org_slug>", {
    status: 200,
  });
});

// ─── Bridge: Twilio ↔ Gemini Live ────────────────────────────────────────────

async function runBridge(twilioWs: WebSocket, slug: string): Promise<void> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

  const bundle = await loadOrgBundle(slug);
  if (!bundle) {
    twilioWs.close(1008, "Organization not found");
    return;
  }

  const orgId = bundle.organization_id;
  const hasQuota = await checkQuota(orgId);
  if (!hasQuota) {
    twilioWs.close(1008, "Voice quota exceeded");
    return;
  }

  const systemPrompt = buildSystemPrompt(bundle);
  const voiceName = bundle.voice_profile?.recommended_voice ?? "Despina";

  // ── Open Gemini Live WebSocket ──
  const geminiWs = new WebSocket(`${GEMINI_WS_BASE}?key=${geminiKey}`);

  let streamSid = "";
  let callSid = "";
  let geminiReady = false;
  const callStartTime = Date.now();
  const transcript: Array<{ role: string; text: string; timestamp: string }> = [];
  let cleanupCalled = false;

  // Wait for Gemini to open, then send the setup message
  const geminiOpened = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Gemini WS open timeout")), 12_000);
    geminiWs.onopen = () => {
      clearTimeout(timeout);
      geminiWs.send(
        JSON.stringify({
          setup: {
            model: GEMINI_MODEL,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              temperature: 0.3,
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "captureLead",
                    description: "Capture the caller's contact information as a sales lead.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING", description: "Caller's full name" },
                        email: { type: "STRING", description: "Caller's email address" },
                        phone: { type: "STRING", description: "Caller's phone number" },
                        interest: { type: "STRING", description: "What product/service they're interested in" },
                      },
                      required: ["name"],
                    },
                  },
                  {
                    name: "scheduleAppointment",
                    description: "Book a follow-up call or meeting for the caller.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        email: { type: "STRING" },
                        phone: { type: "STRING" },
                        date: { type: "STRING", description: "ISO 8601 date-time string" },
                        notes: { type: "STRING", description: "Any additional notes" },
                      },
                      required: ["name", "date"],
                    },
                  },
                  {
                    name: "transferToHuman",
                    description: "Transfer the caller to a human agent.",
                    parameters: { type: "OBJECT", properties: {} },
                  },
                ],
              },
            ],
          },
        })
      );
      resolve();
    };
    geminiWs.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Gemini WS error during open"));
    };
  });

  await geminiOpened;

  // ── Gemini message handler ──
  geminiWs.onmessage = async (event) => {
    let msg: Record<string, unknown>;
    try {
      const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
      msg = JSON.parse(raw);
    } catch { return; }

    // Setup complete → trigger greeting
    if (msg.setupComplete != null) {
      geminiReady = true;
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "Hello" }] }],
              turnComplete: true,
            },
          })
        );
      }
      return;
    }

    // Audio + text from the model
    const parts = (msg as { serverContent?: { modelTurn?: { parts?: unknown[] } } })
      ?.serverContent?.modelTurn?.parts ?? [];

    for (const part of parts as Array<Record<string, unknown>>) {
      // Audio chunk: Gemini outputs 24 kHz PCM → downsample to 8 kHz → μ-law → Twilio
      const inlineData = part.inlineData as { data?: string; mimeType?: string } | undefined;
      if (inlineData?.data && streamSid && twilioWs.readyState === WebSocket.OPEN) {
        const pcm24 = new Int16Array(b64ToUint8(inlineData.data).buffer);
        const pcm8 = downsample24to8(pcm24);
        const mulaw = linear16ToMulaw(pcm8);
        twilioWs.send(
          JSON.stringify({
            event: "media",
            streamSid,
            media: { payload: uint8ToB64(mulaw) },
          })
        );
      }
      // Text transcription
      if (typeof part.text === "string") {
        transcript.push({ role: "agent", text: part.text, timestamp: new Date().toISOString() });
      }
    }

    // User interrupted the agent → clear Twilio audio buffer
    const interrupted = (msg as { serverContent?: { interrupted?: boolean } })
      ?.serverContent?.interrupted;
    if (interrupted && streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
    }

    // Tool calls
    const functionCalls = (msg as { toolCall?: { functionCalls?: unknown[] } })
      ?.toolCall?.functionCalls ?? [];
    if (functionCalls.length > 0) {
      const admin = makeAdmin();
      const responses = [];
      for (const call of functionCalls as Array<{ id: string; name: string; args: Record<string, unknown> }>) {
        let result: Record<string, unknown> = {};
        try {
          if (call.name === "captureLead") {
            await admin.from("leads").insert({
              organization_id: orgId,
              name: String(call.args.name ?? "Unknown"),
              email: String(call.args.email ?? ""),
              phone: call.args.phone ? String(call.args.phone) : null,
              interest: call.args.interest ? String(call.args.interest) : null,
              conversation_id: callSid || null,
            });
            result = { status: "Lead captured successfully" };
          } else if (call.name === "scheduleAppointment") {
            await admin.from("appointments").insert({
              organization_id: orgId,
              name: String(call.args.name ?? "Unknown"),
              email: String(call.args.email ?? ""),
              phone: call.args.phone ? String(call.args.phone) : null,
              date: String(call.args.date ?? new Date().toISOString()),
              notes: call.args.notes ? String(call.args.notes) : null,
            });
            result = { status: "Appointment scheduled successfully" };
          } else if (call.name === "transferToHuman") {
            result = { status: "Transfer initiated — a human will join shortly" };
          }
        } catch (e) {
          console.error(`Tool call ${call.name} failed:`, e);
          result = { error: "Tool execution failed" };
        }
        responses.push({ id: call.id, name: call.name, response: result });
      }
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }
    }
  };

  // ── Twilio message handler ──
  twilioWs.onmessage = (event) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string);
    } catch { return; }

    const ev = msg.event as string;

    if (ev === "start") {
      const start = msg.start as Record<string, string>;
      streamSid = String(msg.streamSid ?? "");
      callSid = start?.callSid ?? "";
      console.log(`Call started: streamSid=${streamSid} callSid=${callSid}`);
    }

    if (ev === "media" && geminiReady && geminiWs.readyState === WebSocket.OPEN) {
      const payload = (msg.media as { payload?: string })?.payload;
      if (!payload) return;
      // Twilio: μ-law 8 kHz → linear PCM 16-bit → upsample to 16 kHz → Gemini
      const mulaw = b64ToUint8(payload);
      const pcm8 = mulawToLinear16(mulaw);
      const pcm16 = upsample8to16(pcm8);
      geminiWs.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: int16ToB64(pcm16) }],
          },
        })
      );
    }

    if (ev === "stop") {
      void cleanup();
    }
  };

  twilioWs.onclose = () => void cleanup();
  twilioWs.onerror = () => void cleanup();
  geminiWs.onclose = () => {
    try { twilioWs.close(); } catch { /* ignore */ }
    void cleanup();
  };
  geminiWs.onerror = (e) => {
    console.error("Gemini WS error:", e);
    try { twilioWs.close(); } catch { /* ignore */ }
  };

  // ── Cleanup: save transcript + log usage ──
  async function cleanup() {
    if (cleanupCalled) return;
    cleanupCalled = true;

    if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
      try { geminiWs.close(); } catch { /* ignore */ }
    }

    const durationSeconds = Math.round((Date.now() - callStartTime) / 1000);
    if (transcript.length === 0 || durationSeconds < 3) return;

    try {
      const admin = makeAdmin();
      const { data: txData } = await admin
        .from("transcripts")
        .insert({
          organization_id: orgId,
          messages: transcript,
          duration_seconds: durationSeconds,
        })
        .select("id")
        .single();

      if (txData?.id) {
        await admin.rpc("log_voice_usage", {
          p_organization_id: orgId,
          p_transcript_id: txData.id,
          p_duration_seconds: durationSeconds,
        });
      }
    } catch (e) {
      console.error("Cleanup save failed:", e);
    }
  }
}
