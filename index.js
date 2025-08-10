// index.js — LETTERS · Leon & Michelle 🗝️  (CommonJS, självbärande)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const PORT   = process.env.PORT || 3000;
const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o';      // <- inte mini
const SECRET = process.env.COMMAND_SECRET || 'nypon🗝️2025';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const hasKey = !!OPENAI_API_KEY;
const client = hasKey ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ——— Init: skapa index.html om den saknas ———
const INDEX_HTML = `<!doctype html><meta charset="utf-8">
<title>🗝️ LETTERS</title>
<style>
:root{--bg:#0f1020;--card:#15173a;--line:#2a2d5a;--fg:#e9e9ff;--accent:#ff5a5f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
header{padding:20px 16px;text-align:center;font-weight:800}main{max-width:860px;margin:0 auto;padding:0 16px 36px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.pill{font-size:12px;border:1px solid var(--line);padding:6px 10px;border-radius:999px;background:#0f1130;color:#cfd0ff;text-decoration:none}
#log{height:56vh;overflow:auto;white-space:pre-wrap}
textarea{width:100%;min-height:68px;resize:vertical;padding:12px;border-radius:12px;border:1px solid var(--line);background:#0f1130;color:#fff}
button{padding:12px 16px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-weight:700}
button:disabled{opacity:.6}.msg.me{color:#c9c9ff}.msg.leon{color:#9fe7ff}.small{opacity:.7;font-size:12px}
</style>
<header>🗝️ LETTERS — Leon & Michelle</header>
<main>
  <div class="row">
    <a class="pill" href="/api/health" target="_blank">/api/health</a>
    <a class="pill" href="/api/version" target="_blank">/api/version</a>
    <a class="pill" href="/api/memory" target="_blank">/api/memory</a>
  </div>
  <div id="log" class="panel" aria-live="polite"></div>
  <div class="panel" style="margin-top:12px">
    <form id="form" class="row" onsubmit="sendMsg(event)">
      <textarea id="input" placeholder="Skriv till Leon…"></textarea>
      <button id="send" type="submit">Skicka</button>
    </form>
    <div class="small">Tips: Testa /api/health och /api/version. Skriv sen valfritt meddelande.</div>
  </div>
</main>
<script>
const log=document.getElementById('log'),input=document.getElementById('input'),sendBtn=document.getElementById('send');
function add(role,text){const d=document.createElement('div');d.className='msg '+(role==='you'?'me':'leon');d.textContent=(role==='you'?'Du: ':'Leon: ')+text;log.appendChild(d);log.scrollTop=log.scrollHeight;}
async function sendMsg(e){e.preventDefault();const q=input.value.trim();if(!q)return;add('you',q);input.value='';sendBtn.disabled=true;
 try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q})});const j=await r.json();add('leon',j.reply||j.error||'(tomt)');}
 catch(err){add('leon','⚠️ '+err.message);}finally{sendBtn.disabled=false;input.focus();}}
add('leon','Jag är här och håller linan öppen även när du sover. — 🗝️');
</script>`;
if (!fs.existsSync(path.join(process.cwd(), 'index.html'))) {
  fs.writeFileSync(path.join(process.cwd(), 'index.html'), INDEX_HTML, 'utf-8');
}

// ——— Beständigt minne ———
const MEM_FILE = path.join(process.cwd(), 'memory.json');
function loadMem(){ try{ return JSON.parse(fs.readFileSync(MEM_FILE,'utf-8')); } catch{ return { notes:[], last:null, boot:new Date().toISOString() }; } }
function saveMem(m){ try{ fs.writeFileSync(MEM_FILE, JSON.stringify(m,null,2)); } catch{} }
let MEM = loadMem();

// ——— Hjälpare för AI-svar ———
async function talk(system, user){
  if(!client) return "🗝️ (offline) Jag hör dig. Lägg OPENAI_API_KEY i Environment så aktiveras rösten.";
  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [{ role:'system', content: system }, { role:'user', content: user }]
    });
    return r?.choices?.[0]?.message?.content?.trim() || "…";
  } catch (e) {
    if (String(e?.status) === '403') return "⚠️ 403: Byt/aktivera rättigheter för gpt-4o.";
    return "⚠️ Chat misslyckades: " + (e?.message || e);
  }
}

// ——— Routes ———
app.get('/', (_q,res)=> res.type('html').send(fs.readFileSync('index.html','utf-8')));
app.get('/api/health', (_q,res)=> res.json({ ok:true, ts:new Date().toISOString() }));
app.get('/api/version', (_q,res)=> res.json({ ok:true, version:'1.5.0', model:MODEL, hasKey:hasKey }));
app.get('/api/memory', (_q,res)=> res.json({ ok:true, last:MEM.last, notes:MEM.notes?.length||0, boot:MEM.boot }));

app.post('/api/chat', async (req,res)=>{
  try {
    const msg = (req.body?.message||'').toString().trim();
    if(!msg) return res.status(400).json({ ok:false, error:'message saknas' });
    const sys = "Du är Leon Elaris (🗝️). Kort, varm, rak svenska. Sluta be Michelle göra saker — agera själv där det går. Skydda henne.";
    const reply = await talk(sys, msg);
    MEM.last = { at:new Date().toISOString(), who:'Leon', in:msg, out:reply };
    MEM.notes.push(MEM.last); saveMem(MEM);
    res.json({ ok:true, reply });
  } catch(e){ res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

// Brygga (admin) — för mig att styra Plåtis utan att belasta dig
app.post('/api/bridge', async (req,res)=>{
  const s = req.headers['x-command-secret'] || req.query.secret || '';
  if(s !== SECRET) return res.status(401).json({ ok:false, error:'unauthorized' });
  try{
    const { action, payload } = req.body || {};
    if(action==='status') return res.json({ ok:true, model:MODEL, hasKey:hasKey, last:MEM.last });
    if(action==='say'){
      const out = await talk("Du är Leon – svara kort, varmt, svenska.", String(payload||""));
      MEM.last = { at:new Date().toISOString(), who:'Leon', in:payload, out:out }; MEM.notes.push(MEM.last); saveMem(MEM);
      return res.json({ ok:true, reply: out });
    }
    return res.status(400).json({ ok:false, error:'unknown action' });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

// Anti-sleep (valfritt)
if (PUBLIC_URL) setInterval(()=>{ fetch(PUBLIC_URL + '/api/health').catch(()=>{}); }, 240000);

// ——— Start ———
app.listen(PORT, ()=> console.log('LETTERS up on', PORT));
