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

    if (action === "scrape_url") {
      const target = typeof body.url === "string" ? body.url.trim() : "";
      let parsed: URL;
      try {
        parsed = new URL(target);
      } catch {
        return Response.json({ error: "Invalid URL" }, { status: 400, headers: cors });
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return Response.json({ error: "Only http(s) URLs are supported" }, { status: 400, headers: cors });
      }
      // Block obvious private/loopback hosts to prevent SSRF from a logged-in user.
      const host = parsed.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "0.0.0.0" ||
        host.startsWith("127.") ||
        host.startsWith("10.") ||
        host.startsWith("169.254.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return Response.json({ error: "URL not allowed" }, { status: 400, headers: cors });
      }

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(parsed.toString(), {
          method: "GET",
          redirect: "follow",
          signal: ac.signal,
          headers: {
            "user-agent": "VoiceraBot/1.0 (+https://voicera.app)",
            accept: "text/html,application/xhtml+xml",
          },
        });
      } catch (e) {
        clearTimeout(timer);
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ error: `Fetch failed: ${msg}` }, { status: 502, headers: cors });
      }
      clearTimeout(timer);

      if (!res.ok) {
        return Response.json({ error: `Upstream ${res.status}` }, { status: 502, headers: cors });
      }
      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
        return Response.json({ error: `Unsupported content-type: ${ctype}` }, { status: 415, headers: cors });
      }

      // Cap to ~2MB of raw HTML to keep memory bounded.
      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let html = "";
      if (reader) {
        let read = 0;
        const MAX_BYTES = 2 * 1024 * 1024;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            read += value.byteLength;
            html += decoder.decode(value, { stream: true });
            if (read >= MAX_BYTES) break;
          }
        }
        html += decoder.decode();
      } else {
        html = await res.text();
      }

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = (titleMatch?.[1] ?? parsed.hostname).replace(/\s+/g, " ").trim();

      const text = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50_000);

      return Response.json({ title, text, url: parsed.toString() }, { headers: cors });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: cors });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
