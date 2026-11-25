// Supabase Edge Function: fetches METARs and TAFs from aviationweather.gov for the app.
// aviationweather.gov doesn't allow browser requests from other sites (no CORS), so the app asks this
// function instead. No API key and no cost beyond Supabase's free function allowance.
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → name "wx", paste this file.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });

const AWC = "https://aviationweather.gov/api/data";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let ids = "";
  try {
    ids = String((await req.json()).ids ?? "").toUpperCase().replace(/\s+/g, "");
  } catch {
    return json({ error: "Send JSON like {\"ids\":\"KOGD,KBMC\"}." }, 400);
  }
  if (!/^[A-Z0-9]{3,4}(,[A-Z0-9]{3,4}){0,9}$/.test(ids)) return json({ error: "Up to 10 airport IDs, comma-separated." }, 400);
  try {
    const [m, t] = await Promise.all([
      fetch(`${AWC}/metar?ids=${ids}&format=json`, { headers: { "User-Agent": "cfi-app-weather" } }),
      fetch(`${AWC}/taf?ids=${ids}&format=json`, { headers: { "User-Agent": "cfi-app-weather" } }),
    ]);
    const metars = m.ok && m.status !== 204 ? await m.json() : [];
    const tafs = t.ok && t.status !== 204 ? await t.json() : [];
    return json({ metars, tafs, fetchedAt: new Date().toISOString() });
  } catch {
    return json({ error: "aviationweather.gov didn't answer. Try again in a minute." }, 502);
  }
});
