const https = require("https");

const SUPABASE_URL = "https://lqiyxkgizgnxpoqovqam.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxaXl4a2dpemdueHBvcW92cWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgwNTYzNSwiZXhwIjoyMDk1MzgxNjM1fQ.2kFYwKFVX8YX7ZfkNoiy5xp1c00PZEDaZQjZjUsPKHA";

// Cache customers to avoid repeated Supabase calls
const customerCache = {};

function fetchCustomer(id) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/customers?id=eq.${id}&select=id,name,primary_color,greeting,logo_url,logo_bg,logo_shape`;
    const req = https.request({
      hostname: "lqiyxkgizgnxpoqovqam.supabase.co",
      path,
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY
      },
      timeout: 8000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const arr = JSON.parse(data);
          resolve(arr[0] || null);
        } catch(e) {
          reject(new Error("Parse error: " + data.slice(0, 100)));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Supabase timeout")); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  try {
    const qs = req.url.includes("?") ? req.url.split("?")[1] : "";
    const params = new URLSearchParams(qs);
    const id = params.get("id");

    if (!id) {
      return res.end('console.error("ChatBot: Missing id");');
    }

    // Use cache if available
    let c = customerCache[id];
    if (!c) {
      c = await fetchCustomer(id);
      if (c) customerCache[id] = c;
    }

    if (!c) {
      return res.end('console.error("ChatBot: Customer not found");');
    }

    const color = (c.primary_color || "#f0c040").replace(/"/g, "");
    const name = (c.name || "Chatbot").replace(/\\/g, "").replace(/"/g, "'");
    const greeting = (c.greeting || "Hej!").replace(/\\/g, "").replace(/"/g, "'");
    const logoHtml = c.logo_url
      ? `<img src="${c.logo_url}" style="width:32px;height:32px;object-fit:contain;border-radius:${c.logo_shape||'50%'};background:${c.logo_bg||'#000'};padding:2px;">`
      : name.slice(0,2).toUpperCase();

    const script = `(function(){
var color="${color}",name="${name}",greeting="${greeting}",id="${c.id}";
var logo=${JSON.stringify(logoHtml)};
var base="https://chatbot-saas.vercel.app";
var s=document.createElement("style");
s.textContent="#cbp-btn{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:"+color+";border:none;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.25);z-index:9998;color:white}#cbp-win{position:fixed;bottom:96px;right:24px;width:340px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;z-index:9999;font-family:sans-serif}#cbp-win.hidden{display:none}#cbp-hdr{padding:1rem;display:flex;align-items:center;gap:.7rem;background:"+color+"}#cbp-logo{width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;color:#fff;overflow:hidden;flex-shrink:0}#cbp-hdr-txt{flex:1}#cbp-hdr-txt strong{display:block;color:#fff;font-size:.9rem}#cbp-hdr-txt span{color:rgba(255,255,255,0.85);font-size:.72rem}#cbp-close{background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:1rem}#cbp-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem;background:#f8f8f8}.cbp-bot{max-width:85%;padding:.65rem .9rem;font-size:.84rem;line-height:1.5;background:#fff;border-radius:14px 14px 14px 4px;align-self:flex-start;color:#1a1a1a;box-shadow:0 1px 4px rgba(0,0,0,0.08)}.cbp-user{max-width:85%;padding:.65rem .9rem;font-size:.84rem;line-height:1.5;border-radius:14px 14px 4px 14px;align-self:flex-end;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.08);background:"+color+"}#cbp-inp-area{padding:.75rem;border-top:1px solid #eee;display:flex;gap:.5rem;background:#fff}#cbp-inp{flex:1;border:1px solid #ddd;border-radius:20px;padding:.55rem 1rem;font-size:.85rem;outline:none;background:#f5f5f5;color:#333}#cbp-send{width:38px;height:38px;border-radius:50%;border:none;color:#fff;cursor:pointer;flex-shrink:0;font-size:1rem;background:"+color+"}";
document.head.appendChild(s);
var d=document.createElement("div");
d.innerHTML='<button id="cbp-btn" onclick="cbpToggle()">💬</button><div id="cbp-win" class="hidden"><div id="cbp-hdr"><div id="cbp-logo">'+logo+'</div><div id="cbp-hdr-txt"><strong>'+name+'</strong><span>Hur kan vi hjälpa dig?</span></div><button id="cbp-close" onclick="cbpToggle()">×</button></div><div id="cbp-msgs"><div class="cbp-bot">'+greeting+'</div></div><div id="cbp-inp-area"><input id="cbp-inp" placeholder="Skriv din fråga..." onkeydown="if(event.key===\'Enter\')cbpSend()"/><button id="cbp-send" onclick="cbpSend()">➤</button></div></div>';
document.body.appendChild(d);
var msgs=[],loading=false;
window.cbpToggle=function(){var w=document.getElementById("cbp-win"),b=document.getElementById("cbp-btn");w.classList.toggle("hidden");b.textContent=w.classList.contains("hidden")?"💬":"×";};
function addMsg(t,r){var m=document.getElementById("cbp-msgs"),d=document.createElement("div");d.className=r==="user"?"cbp-user":"cbp-bot";d.textContent=t;m.appendChild(d);m.scrollTop=m.scrollHeight;}
window.cbpSend=async function(){var inp=document.getElementById("cbp-inp"),msg=inp.value.trim();if(!msg||loading)return;inp.value="";loading=true;document.getElementById("cbp-send").disabled=true;addMsg(msg,"user");msgs.push({role:"user",content:msg});try{var r=await fetch(base+"/api/chat?id="+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:msgs})});var data=await r.json();var reply=data.content&&data.content[0]?data.content[0].text:"Kunde inte svara.";addMsg(reply,"bot");msgs.push({role:"assistant",content:reply});}catch(e){addMsg("Något gick fel. Försök igen!","bot");}loading=false;document.getElementById("cbp-send").disabled=false;};
})();`;

    res.end(script);
  } catch(e) {
    res.end('console.error("ChatBot error: ' + e.message.replace(/['"]/g, '') + '");');
  }
};
