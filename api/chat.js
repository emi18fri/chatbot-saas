const https = require("https");

const SUPABASE_URL = "https://lqiyxkgizgnxpoqovqam.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxaXl4a2dpemdueHBvcW92cWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgwNTYzNSwiZXhwIjoyMDk1MzgxNjM1fQ.2kFYwKFVX8YX7ZfkNoiy5xp1c00PZEDaZQjZjUsPKHA";

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: headers || {}
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const cache = {};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const params = new URLSearchParams(req.url.split("?")[1] || "");
    const customerId = params.get("id");
    if (!customerId) return res.status(400).json({ error: "Missing id" });

    const data = await httpsGet(
      SUPABASE_URL + "/rest/v1/customers?id=eq." + customerId + "&select=*",
      { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    );
    const customers = JSON.parse(data);
    const c = customers[0];
    if (!c) return res.status(404).json({ error: "Customer not found" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing" });

    const { messages } = req.body;

    let websiteInfo = "";
    if (c.website_url && cache[c.id]) {
      websiteInfo = cache[c.id].content;
    } else if (c.website_url && !cache[c.id]) {
      try {
        const html = await Promise.race([
          httpsGet(c.website_url, { "User-Agent": "Mozilla/5.0" }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
        ]);
        websiteInfo = stripHtml(html).slice(0, 5000);
        cache[c.id] = { content: websiteInfo, time: Date.now() };
      } catch(e) {}
    }
      const system =
  "Du är en hjälpsam assistent för " + c.name + ". " +
  "Svara alltid kort och professionellt, utan markdown-formatering - inga stjärnor, inga bindestreck som listor, ingen fetstil. Skriv som vanlig text. " +
  "Svara på samma språk som användaren skriver på. " +
  "Hänvisa aldrig till hemsidan. Ge kontaktuppgifterna i slutet av svaret när det är relevant, till exempel när kunden frågar om en tjänst, pris eller vill gå vidare med ett projekt. " +
  "Om du inte förstår frågan, svara med: Förlåt, jag förstod inte riktigt. Kan du förklara lite tydligare? " +
  "Du ska svara på frågor om ROT-avdrag. ROT-avdraget ger 30% avdrag på arbetskostnaden upp till 50 000 kr per person och år. Renoveringar, markarbeten och vissa byggtjänster kan berättiga till ROT-avdrag. " +
  "Du ska svara på frågor om bygglov. Bygglov krävs ofta för nybyggnation, tillbyggnader och vissa renoveringar. Priser för bygglov: Nybygge ca 20 000-50 000 kr, tillbyggnad ca 5 000-20 000 kr, Attefallshus ca 2 000-7 000 kr. " +
  (c.extra_info ? "\n\nExtra information om företaget:\n" + c.extra_info : "") +
  (websiteInfo ? "\n\nInfo från hemsidan:\n" + websiteInfo : "");

    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system,
      messages
    });

    return new Promise((resolve) => {
      const proxyReq = https.request({
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body)
        }
      }, (proxyRes) => {
        let d = "";
        proxyRes.on("data", chunk => d += chunk);
        proxyRes.on("end", () => { res.status(proxyRes.statusCode).json(JSON.parse(d)); resolve(); });
      });
      proxyReq.on("error", (err) => { res.status(500).json({ error: err.message }); resolve(); });
      proxyReq.write(body);
      proxyReq.end();
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
