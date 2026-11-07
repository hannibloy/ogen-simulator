// סימולטור עוגן: שכבת שרת דקה. הדפדפן שולח פרומפט, השרת פונה ל-Anthropic API עם המפתח של חני ומחזיר JSON.
// המפתח נמצא רק במשתני הסביבה של Vercel (ANTHROPIC_API_KEY) ולעולם לא מגיע לדפדפן.
const MODELS = {
  quick: process.env.MODEL_QUICK || "claude-haiku-5-5",
  default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5",
};
const MAX_PROMPT = 24000;

function extractJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ code: "method", error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ code: "no_key", error: "ANTHROPIC_API_KEY is not set" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const prompt = body && typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ code: "bad_request", error: "prompt missing or too long" });
  const tier = body.tier === "default" ? "default" : "quick";

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), tier === "default" ? 55000 : 28000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELS[tier],
        max_tokens: tier === "default" ? 2000 : 400,
        temperature: tier === "default" ? 0.3 : 0.6,
        system: "אתה מחזיר אך ורק אובייקט JSON תקין אחד, בלי טקסט לפניו או אחריו ובלי גדרות קוד.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (r.status === 429) return res.status(429).json({ code: "rate_limited", error: "rate limited" });
    if (r.status === 401 || r.status === 403) return res.status(503).json({ code: "no_key", error: "invalid key" });
    if (!r.ok) return res.status(502).json({ code: "upstream", error: (data && data.error && data.error.message) || "upstream error" });
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const result = extractJson(text);
    if (!result) return res.status(502).json({ code: "bad_json", error: "model did not return JSON" });
    return res.status(200).json({ result });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && e.name === "AbortError";
    return res.status(aborted ? 504 : 502).json({ code: aborted ? "timeout" : "server", error: String(e && e.message || e) });
  }
};
