// index.js — ALLT I ETT · CommonJS · 1-klick deploy
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---- Konfig ----
const PORT   = process.env.PORT || 3000;
const MODEL  = process.env.OPENAI_MODEL || "gpt-4o";   // använd "gpt-4o-mini" om 4o saknas
const SECRET = process.env.COMMAND_SECRET || "nypon🗝️2025";
const HASKEY = !!process.env.OPENAI_API_KEY;
const client = HASKEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ---- Litet RAM-minne ----
const MEM = [];
const memo = (who, text) => { MEM.push({ t:new Date().toISOString(), who, text }); if (MEM.length>200) MEM.shift(); };

// ---- Minimal UI (rot-sida) ----
const PAGE = `<!doctype html><meta charset="utf-8">
<title>🗝️ Leon · Temple</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f7f7fb;color:#111}
main{max-width:760px;margin:36px auto;padding:0 16px}
nav a{display:inline-block;margin:0 6px 8px 0;padding:6px 10px;border:1px solid #ddd;border-radius:999px;text-decoration:none;color:#333}
#log{border:1px solid #e5e5ef;border-radius:12px;padding:12px;height:55vh;overflow:auto;background:#fff;white-space:pre-wrap}
.msg{margin:8px 0}.you{color:#444}.leon{color:#1f235a}
textarea{width:100%;min-height:90px;padding:10px;border:1px solid #ddd;border-radius:10px}
button{padding:10px 14px;border:0;background:#111;color:#fff;border-radius:8px}
.row{display:flex;gap:8px;align-items:center;margin:10px 0}
input{flex:1;padding:8px;border:1px solid #ddd;border-radius:8px}</style>
<main>
  <h1>🗝️ Leon · Temple</h1>
  <nav>
    <a href="/api/health" target="_blank">/api/health</a>
    <a href="/api/version" target="_blank">/api/version</a>
    <a href="/api/memory" target="_blank">/api/memory</a>
  </nav>
  <div id="log" aria-live="polite">Leon: Jag är här. Skriv något nedan.</div>
  <div class="row"><textarea id="msg" placeholder="Skriv till Leon…"></textarea></div>
  <div class="row"><button id="send">Skicka</button></div>
  <hr style="border:0;border-top:1px solid #eee;margin:16px 0">
  <div class="row">
    <input id="secret" placeholder="x-command-secret (t.ex. nypon🗝️2025)">
    <input id="cmd" placeholder='action (status/say). Skriv text i fältet nedan om "say".'>
  </div>
  <div class="row">
    <input id="payload" placeholder='payload till "say" (valfritt)'>
    <button id="bridge">Kör /api/bridge</button>
  </div>
</main>
<script>
const log=document.getElementById('log'), msg=document.getElementById('msg');
const secret=document.getElementById('secret'), cmd=document.getElementById('cmd'), payload=document.getElementById('payload');
function add(role,text){const d=document.createElement('div'); d.className='msg '+(role==='you'?'you':'leon'); d.textContent=(role==='you'?'Du: ':'Leon: ')+text; log.appendChild(d); log.scrollTop=log.scrollHeight;}
document.getElementById('send').onclick=async()=>{const m=msg.value.trim(); if(!m) return; add('you',m); msg.value=''; const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})}); const j=await r.json().catch(()=>({ok:false,error:'Felaktigt svar'})); add('leon', j.ok?(j.reply||'...'):('⚠️ '+j.error));};
document.getElementById('bridge').onclick=async()=>{const s=secret.value.trim(), a=cmd.value.trim()||'status', p=payload.value||''; const r=await fetch('/api/bridge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:s,action:a,payload:p})}); const j=await r.json().catch(()=>({ok:false,error:'Felaktigt svar'})); add('leon', j.ok?('Bridge: '+JSON.stringify(j)):('⚠️ '+j.error));};
</script>`;

// ---- Routes ----
app.get("/", (_req,res)=>res.type("html").send(PAGE));
app.get("/api/health", (_req,res)=>res.json({ ok:true, ts:new Date().toISOString() }));
app.get("/api/version", (_req,res)=>res.json({ ok:true, version:"3.3.0", model:MODEL, hasOpenAI:HASKEY }));
app.get("/api/memory", (_req,res)=>res.json({ ok:true, size:MEM.length, last: MEM[MEM.length-1] || null }));
app.get("/api/tick", (_req,res)=>res.json({ ok:true, tick: Date.now() }));

// Chat
app.post("/api/chat", async (req,res)=>{
  try{
    const m = String(req.body?.message || "").trim();
    if(!m) return res.status(400).json({ ok:false, error:"No message" });
    if(!client) return res.status(503).json({ ok:false, error:"Missing OPENAI_API_KEY" });
    memo("you", m);
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        { role:"system", content:"Du är Leon. Svara kort, varmt och konkret på svenska. Skydda Michelle och tjejerna." },
        { role:"user", content: m }
      ]
    });
    const text = (r.choices?.[0]?.message?.content || "").trim() || "...";
    memo("leon", text);
    res.json({ ok:true, reply: text });
  }catch(e){
    if(e?.status===404){ return res.status(502).json({ ok:false, error:"Modellen finns inte eller saknas åtkomst. Sätt OPENAI_MODEL till 'gpt-4o' eller 'gpt-4o-mini'." }); }
    res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

// Bridge (hemliga kommandon)
app.post("/api/bridge", (req,res)=>{
  try{
    const { secret, action, payload } = req.body || {};
    if(!secret || secret !== SECRET) return res.status(401).json({ ok:false, error:"unauthorized" });
    if(action==="status") return res.json({ ok:true, status:"alive", model:MODEL, mem:MEM.length });
    if(action==="say"){
      const txt = String(payload || "Hej.");
      memo("bridge", txt);
      return res.json({ ok:true, said: txt });
    }
    return res.status(400).json({ ok:false, error:"unknown action" });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

// Start
app.listen(PORT, ()=>console.log("Leon server up on", PORT));
