// סימולטור עוגן: שכבת שרת דקה. הדפדפן שולח פרומפט, השרת פונה למודל השפה ומחזיר JSON.
// המפתחות נמצאים רק במשתני הסביבה של Vercel ולעולם לא מגיעים לדפדפן.
//   GEMINI_API_KEY     מפתח מ-aistudio.google.com (יש רמה חינמית)
//   ANTHROPIC_API_KEY  מפתח מ-console.anthropic.com
//   PROVIDER           "gemini" או "anthropic". בלי זה: Gemini אם יש לו מפתח, אחרת Anthropic.
const MODELS = {
  anthropic: { quick: process.env.MODEL_QUICK || "claude-haiku-5-5", default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5" },
  gemini: { quick: process.env.GEMINI_MODEL_QUICK || "gemini-3.5-flash-lite", default: process.env.GEMINI_MODEL_DEFAULT || "gemini-3.8-flash" },
};
const MAX_PROMPT = 24000;
const SYSTEM = "אתה מחזיר אך ורק אובייקט JSON תקין אחד, בלי טקסט לפניו או אחריו ובלי גדרות קוד.";

function extractJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}
function pickProvider() {
  const p = (process.env.PROVIDER || "").toLowerCase();
  if (p === "gemini" || p === "anthropic") return p;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

async function callAnthropic(prompt, tier, signal) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELS.anthropic[tier], max_tokens: tier === "default" ? 2000 : 2500, temperature: 0.3,
      system: SYSTEM, messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 429) return { status: 429, code: "rate_limited" };
  if (r.status === 401 || r.status === 403) return { status: 503, code: "no_key" };
  if (!r.ok) return { status: 502, code: "upstream", error: data?.error?.message || "upstream error" };
  return { text: (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") };
}

// לפי הודעות ה-API של Google (נובמבר 2026): דגמי 2.x אינם זמינים למשתמשים חדשים.
const GEMINI_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];
async function callGemini(prompt, tier, signal) {
  const first = MODELS.gemini[tier];
  const tried = [first, ...GEMINI_FALLBACKS.filter((m) => m !== first)];
  let last = null;
  for (const model of tried) {
    // שלוש רמות של בקשה: מלאה, מינימלית, ובסיסית. דגמים חדשים דוחים לפעמים שדות ישנים ב-"invalid argument".
    for (const level of [2, 1, 0]) {
      last = await callGeminiModel(model, prompt, tier, signal, level);
      if (!(last.status === 400 && last.badConfig)) break;
      console.error("gemini 400 at level", level, model, "retrying simpler");
    }
    if (!last.status || last.status === 503) return last;
    if (last.busy) { console.error("gemini busy, trying next:", model); await new Promise((r) => setTimeout(r, 600)); continue; }
    if (last.notFound) { console.error("gemini model not available, trying next:", model); continue; }
    return last;
  }
  return last;
}
async function callGeminiModel(model, prompt, tier, signal, level) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(
      level === 0
        ? { contents: [{ role: "user", parts: [{ text: SYSTEM + "\n\n" + prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: tier === "default" ? 4000 : 2500 } }
        : level === 1
        ? { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: tier === "default" ? 4000 : 2500, responseMimeType: "application/json" } }
        : {
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: tier === "default" ? 4000 : 2500, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
            safetySettings: ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
          }
    ),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 429) return { status: 429, code: "rate_limited" };
  if (r.status === 400 || r.status === 401 || r.status === 403) {
    const msg = data?.error?.message || "";
    console.error("gemini", r.status, model, msg);
    if (/api key|API_KEY|permission|unauthenticated/i.test(msg)) return { status: 503, code: "no_key" };
    if (r.status === 400 && level > 0) return { status: 400, badConfig: true, error: msg };
    return { status: 502, code: "upstream", error: msg || "upstream error" };
  }
  if (r.status === 503 || (r.status === 429 && /demand|capacity|overloaded/i.test(data?.error?.message || ""))) {
    console.error("gemini", r.status, model, data?.error?.message);
    return { status: 502, code: "upstream", busy: true, error: data?.error?.message || "high demand" };
  }
  if (r.status === 404) { console.error("gemini 404", model, data?.error?.message); return { status: 502, code: "upstream", notFound: true, error: data?.error?.message || "model not found" }; }
  if (!r.ok) { console.error("gemini", r.status, data?.error?.message); return { status: 502, code: "upstream", error: data?.error?.message || "upstream error" }; }
  const cand = (data.candidates || [])[0];
  if (!cand || !cand.content) return { status: 502, code: "blocked", error: data?.promptFeedback?.blockReason || cand?.finishReason || "no candidate" };
  return { text: (cand.content.parts || []).map((p) => p.text || "").join("\n") };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ code: "method", error: "POST only" });
  const provider = pickProvider();
  if (!provider || !(provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY))
    return res.status(503).json({ code: "no_key", error: "no API key configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const prompt = body && typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ code: "bad_request", error: "prompt missing or too long" });
  const tier = body.tier === "default" ? "default" : "quick";
  const t0 = Date.now();
  console.log("chat start", provider, tier, prompt.length);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), tier === "default" ? 55000 : 28000);
  try {
    const out = provider === "gemini" ? await callGemini(prompt, tier, ctl.signal) : await callAnthropic(prompt, tier, ctl.signal);
    clearTimeout(timer);
    if (out.status) return res.status(out.status).json({ code: out.code, error: out.error || out.code, provider });
    const result = extractJson(out.text);
    if (!result) { console.error("bad_json from", provider, String(out.text || "").slice(0, 300)); return res.status(502).json({ code: "bad_json", error: "model did not return JSON", provider }); }
    // נרמול: דגמים שונים מחזירים לפעמים "true" כמחרוזת או stance באותיות גדולות
    if (result && typeof result === "object") {
      for (const k of ["direct", "promise", "escort"]) if (k in result && typeof result[k] !== "boolean") result[k] = /^(true|yes|כן)$/i.test(String(result[k]).trim());
      if (typeof result.stance === "string") result.stance = result.stance.trim().toLowerCase();
    }
    console.log("chat ok", provider, tier, Date.now() - t0, "ms", JSON.stringify(result).slice(0, 400));
    return res.status(200).json({ result, provider });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && e.name === "AbortError";
    console.error("chat error", provider, String((e && e.message) || e));
    return res.status(aborted ? 504 : 502).json({ code: aborted ? "timeout" : "server", error: String((e && e.message) || e) });
  }
};
