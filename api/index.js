const https = require("https");

const SUPABASE_URL = "https://lqiyxkgizgnxpoqovqam.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxaXl4a2dpemdueHBvcW92cWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgwNTYzNSwiZXhwIjoyMDk1MzgxNjM1fQ.2kFYwKFVX8YX7ZfkNoiy5xp1c00PZEDaZQjZjUsPKHA";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : require("http");
    lib.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchSupabase(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + "/rest/v1/" + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.end();
  });
}

const cache = {};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const path = req.url.split("?")[0];
  const params = new URLSearchParams(req.url.split("?")[1] || "");
  const customerId = params.get("id");

  if (!customerId) return res.status(400).json({ error: "Missing customer id" });

  // Get customer from Supabase
  let customer;
  try {
    const customers = await fetchSupabase(`customers?id=eq.${customerId}&select=*`);
    customer = customers[0];
    if (!customer) return res.status(404).json({ error: "Customer not found" });
  } catch(e) {
    return res.status(500).json({ error: "Database error: " + e.message });
  }

  // Serve embed script
  if (path === "/chat.js") {
    const script = `
(function() {
  var config = {
    id: "${customer.id}",
    name: ${JSON.stringify(customer.name)},
    color: ${JSON.stringify(customer.primary_color)},
    greeting: ${JSON.stringify(customer.greeting)},
    logo: ${JSON.stringify(customer.logo_url || '')},
    apiBase: "https://chatbot-saas.vercel.app"
  };

  var style = document.createElement("style");
  style.textContent = [
    "#cbp-btn{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:" + config.color + ";border:none;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.25);z-index:9998;color:white}",
    "#cbp-win{position:fixed;bottom:96px;right:24px;width:340px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;z-index:9999;font-family:sans-serif}",
    "#cbp-win.hidden{display:none}",
    "#cbp-hdr{background:" + config.color + ";padding:1rem;display:flex;align-items:center;gap:.7rem}",
    "#cbp-logo{width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;color:#fff}",
    "#cbp-hdr-txt{flex:1}",
    "#cbp-hdr-txt strong{display:block;color:#fff;font-size:.9rem}",
    "#cbp-hdr-txt span{color:rgba(255,255,255,0.85);font-size:.72rem}",
    "#cbp-close{background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer}",
    "#cbp-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem;background:#f8f8f8}",
    ".cbp-bot{max-width:85%;padding:.65rem .9rem;font-size:.84rem;line-height:1.5;background:#fff;border-radius:14px 14px 14px 4px;align-self:flex-start;color:#1a1a1a;box-shadow:0 1px 4px rgba(0,0,0,0.08)}",
    ".cbp-user{max-width:85%;padding:.65rem .9rem;font-size:.84rem;line-height:1.5;background:" + config.color + ";border-radius:14px 14px 4px 14px;align-self:flex-end;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.08)}",
    "#cbp-inp-area{padding:.75rem;border-top:1px solid #eee;display:flex;gap:.5rem;background:#fff}",
    "#cbp-inp{flex:1;border:1px solid #ddd;border-radius:20px;padding:.55rem 1rem;font-size:.85rem;outline:none;background:#f5f5f5;color:#333}",
    "#cbp-send{width:38px;height:38px;border-radius:50%;background:" + config.color + ";border:none;color:#fff;cursor:pointer;flex-shrink:0}"
  ].join("");
  document.head.appendChild(style);

  var html = '<button id="cbp-btn" onclick="cbpToggle()">💬</button>' +
    '<div id="cbp-win" class="hidden">' +
    '<div id="cbp-hdr">' +
    '<div id="cbp-logo">' + (config.logo ? '<img src="' + config.logo + '" style="width:32px;height:32px;object-fit:contain;border-radius:50%;">' : config.name.slice(0,2).toUpperCase()) + '</div>' +
    '<div id="cbp-hdr-txt"><strong>' + config.name + '</strong><span>Hur kan vi hjälpa dig?</span></div>' +
    '<button id="cbp-close" onclick="cbpToggle()">x</button>' +
    '</div>' +
    '<div id="cbp-msgs"><div class="cbp-bot">' + config.greeting + '</div></div>' +
    '<div id="cbp-inp-area">' +
    '<input id="cbp-inp" placeholder="Skriv din fråga..." onkeydown="if(event.key===\'Enter\')cbpSend()"/>' +
    '<button id="cbp-send" onclick="cbpSend()">&#62;</button>' +
    '</div></div>';

  var div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);

  var cbpMsgs = [], cbpLoading = false;

  window.cbpToggle = function() {
    var w = document.getElementById("cbp-win");
    var b = document.getElementById("cbp-btn");
    w.classList.toggle("hidden");
    b.textContent = w.classList.contains("hidden") ? "💬" : "x";
  };

  function cbpAddMsg(text, role) {
    var d = document.createElement("div");
    d.className = role === "user" ? "cbp-user" : "cbp-bot";
    d.textContent = text;
    var m = document.getElementById("cbp-msgs");
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
  }

  window.cbpSend = async function() {
    var inp = document.getElementById("cbp-inp");
    var msg = inp.value.trim();
    if (!msg || cbpLoading) return;
    inp.value = "";
    cbpLoading = true;
    cbpAddMsg(msg, "user");
    cbpMsgs.push({ role: "user", content: msg });
    try {
      var res = await fetch(config.apiBase + "/api/chat?id=" + config.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: cbpMsgs })
      });
      var data = await res.json();
      var reply = data.content && data.content[0] ? data.content[0].text : "Kunde inte svara.";
      cbpAddMsg(reply, "bot");
      cbpMsgs.push({ role: "assistant", content: reply });
    } catch(e) {
      cbpAddMsg("Något gick fel. Försök igen!", "bot");
    }
    cbpLoading = false;
  };
})();
`;
    res.setHeader("Content-Type", "application/javascript");
    return res.send(script);
  }

  // Handle chat API
  if (path === "/api/chat" && req.method === "POST") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing" });

    const { messages } = req.body;

    // Fetch website content
    let websiteInfo = "";
    if (customer.website_url) {
      const cacheKey = customer.id;
      if (cache[cacheKey] && (Date.now() - cache[cacheKey].time < 3 * 60 * 60 * 1000)) {
        websiteInfo = cache[cacheKey].content;
      } else {
        try {
          const html = await fetchUrl(customer.website_url);
          websiteInfo = stripHtml(html).slice(0, 8000);
          cache[cacheKey] = { content: websiteInfo, time: Date.now() };
        } catch(e) {}
      }
    }

    const system = `Du är en hjälpsam assistent för ${customer.name}. Svara alltid kort och professionellt utan markdown-formatering. Svara på samma språk som användaren skriver på.${customer.extra_info ? "\n\nExtra information om företaget:\n" + customer.extra_info : ""}${websiteInfo ? "\n\nInfo från hemsidan:\n" + websiteInfo : ""}`;

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
        let data = "";
        proxyRes.on("data", chunk => data += chunk);
        proxyRes.on("end", () => {
          res.status(proxyRes.statusCode).json(JSON.parse(data));
          resolve();
        });
      });
      proxyReq.on("error", (err) => { res.status(500).json({ error: err.message }); resolve(); });
      proxyReq.write(body);
      proxyReq.end();
    });
  }

  res.status(404).json({ error: "Not found" });
};
