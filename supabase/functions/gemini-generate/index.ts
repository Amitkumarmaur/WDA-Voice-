import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI, Type } from "npm:@google/genai";

/** Gemini 3.1 Flash Live — keep in sync with `GEMINI_LIVE_MODEL` in `src/config/geminiLive.ts`. */
const GEMINI_MODEL = "gemini-3.1-flash-live-preview";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function voiceQuotaBlockResponse(
  admin: SupabaseClient,
  orgId: string,
): Promise<Response | null> {
  const { data: org, error } = await admin
    .from("organizations")
    .select("monthly_voice_minutes_used, monthly_voice_minutes_limit")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !org) {
    return Response.json({ error: "Organization not found", code: "org_not_found" }, { status: 404, headers: cors });
  }
  const used = Number(org.monthly_voice_minutes_used ?? 0);
  const limit = Number(org.monthly_voice_minutes_limit ?? 0);
  if (used >= limit) {
    return Response.json(
      {
        error:
          "Monthly voice minutes quota reached for this workspace. Upgrade or wait until usage resets.",
        code: "voice_quota_exceeded",
      },
      { status: 402, headers: cors },
    );
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return Response.json({ error: "Server missing GEMINI_API_KEY" }, { status: 500, headers: cors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!mem?.organization_id) {
      return Response.json({ error: "No organization" }, { status: 403, headers: cors });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const blocked = await voiceQuotaBlockResponse(admin, mem.organization_id);
      if (blocked) return blocked;
    } else {
      console.warn("gemini-generate: SUPABASE_SERVICE_ROLE_KEY unset; voice quota not enforced");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as string;
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    if (action === "transcribe_audio") {
      const mimeType = body.mimeType as string;
      const data = body.data as string;
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { inlineData: { mimeType, data } },
          {
            text: "Please transcribe this audio file accurately. Provide only the transcription text.",
          },
        ],
      });
      return Response.json({ text: result.text ?? "" }, { headers: cors });
    }

    if (action === "analyze_voice") {
      const mimeType = body.mimeType as string;
      const data = body.data as string;
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { inlineData: { mimeType, data } },
          {
            text: `Analyze this voice sample and describe its characteristics in extreme detail.
            Return JSON with keys: name, description, tone, pace, pitch, intonation, nuances, energyLevel, recommendedVoice (exactly one of: Kore, Zephyr, Aoede — Gemini Live prebuilt voices matching this app's voice picker).`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              tone: { type: Type.STRING },
              pace: { type: Type.STRING },
              pitch: { type: Type.STRING },
              intonation: { type: Type.STRING },
              nuances: { type: Type.STRING },
              energyLevel: { type: Type.STRING },
              recommendedVoice: {
                type: Type.STRING,
                format: 'enum',
                enum: ['Kore', 'Zephyr', 'Aoede'],
                description: 'Closest Gemini Live prebuilt voice for this sample.',
              },
            },
            required: [
              "name",
              "description",
              "tone",
              "pace",
              "pitch",
              "intonation",
              "nuances",
              "energyLevel",
              "recommendedVoice",
            ],
          },
        },
      });
      return Response.json({ profileJson: result.text ?? "{}" }, { headers: cors });
    }

    if (action === "analyze_kb") {
      const prompt = body.prompt as string;
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      return Response.json({ text: result.text ?? "" }, { headers: cors });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: cors });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
