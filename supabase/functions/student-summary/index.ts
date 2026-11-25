// Supabase Edge Function: summarizes a student's strengths and needs-work from their lesson log.
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret, never in the app.
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → name "student-summary",
// paste this file. Then Edge Functions → Secrets → add ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

interface Entry { date?: string; kind?: string; lesson?: string; notes?: string; hrs?: string; tail?: string }
interface Body {
  name?: string;
  goal?: string;
  stage?: string;
  strengths?: string;
  weaknesses?: string;
  log?: Entry[];
}

const SYSTEM = `You help a certificated flight instructor (CFI) keep a student's training record current.
From the instructor's own lesson notes, write two short summaries:
- strengths: what the student does consistently well now.
- needsWork: what the student should keep working on next.

Rules:
- Base every point on the notes. Do not invent maneuvers, scores or events the notes don't mention.
- Weight recent lessons most; if an early weakness is later described as fixed, it is no longer a weakness.
- Use the instructor's terms (ACS task names, aviation abbreviations like TPA, GUMPS, CTAF) as they wrote them.
- Write 2 to 5 short phrases for each, separated by semicolons, in the style of a logbook remark. No full sentences, no names, no preamble.
- If the notes don't support a field, return an empty string for it.`;

const SCHEMA = {
  type: "object",
  properties: {
    strengths: { type: "string" },
    needsWork: { type: "string" },
  },
  required: ["strengths", "needsWork"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // Only signed-in app users may use the function (it spends API credit).
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return json({ error: "Sign in to use AI summaries." }, 401);

  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "The ANTHROPIC_API_KEY secret isn't set in Supabase." }, 500);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  const log = (body.log ?? []).filter((e) => (e.notes ?? "").trim() || (e.lesson ?? "").trim());
  if (!log.length) return json({ error: "This student has no lesson notes to summarize yet." }, 400);

  // Newest first, so the model weights recent lessons.
  log.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const notes = log
    .map((e) => {
      const head = [e.date, e.kind === "ground" ? "ground" : "flight", e.tail, e.hrs && e.hrs + " hr", e.lesson].filter(Boolean).join(" · ");
      return `<lesson>\n${head}\n${(e.notes ?? "").trim()}\n</lesson>`;
    })
    .join("\n");

  const prompt = `Student training for: ${body.goal || "unknown"}${body.stage ? ` (stage: ${body.stage})` : ""}
Current instructor summary, for reference only:
Strengths: ${body.strengths || "(none)"}
Needs work: ${body.weaknesses || "(none)"}

Lesson notes, newest first:
${notes}`;

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // A policy decline is retried on a suitable fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") return json({ error: "The summary request was declined. Try again later." }, 502);
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No summary came back. Try again." }, 502);
    const out = JSON.parse(text.text) as { strengths: string; needsWork: string };
    return json({ strengths: out.strengths, needsWork: out.needsWork, lessons: log.length });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Too many requests right now. Try again in a minute." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude API error ${e.status}: ${e.message}` }, 502);
    return json({ error: "Couldn't reach Claude. Try again." }, 502);
  }
});
