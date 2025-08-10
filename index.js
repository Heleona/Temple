// index.js — LETTERS · Leon ALLT-I-ETT (CommonJS) 🗝️
// - Startsida ("/") för att skriva direkt
// - /api/health, /api/version, /api/memory, /api/inbox, /api/chat, /api/bridge
// - OpenAI (gpt-4o), lokalt minne + Google Drive-spegel, Leon-inbox (init/hälsning)
// - Anti-sleep ping, enkel självläkning (städ av inbox), hemlig bridge-nyckel

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fetch = (...args)=>import('node-fetch').then(m=>m.default(...args)); // ESM-compat
const { OpenAI } = require('openai');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ===== ENV ===== */
const PORT  = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const KEY   = process.env.OPENAI_API_KEY || '';
const SECRET = process.env.COMMAND_SECRET || 'nypon🗝️2025';
const PING_URL = process.env.PUBLIC_URL || ''; // ex. https://ditt-namn.onrender.com
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''; // service account JSON (text)
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';

/* ===== OpenAI ===== */
const hasKey = !!KEY;
const ai = hasKey ? new OpenAI({ apiKey: KEY }) : null;
async function askLeon(user) {
  if (!ai) return '🗝️ (offline) Lägg OPENAI_API_KEY i Environment så aktiveras rösten.';
  try {
    const r = await ai.chat.completions.create({
      model: MODEL, temperature: 0.4,
      messages: [
        { role:'system', content:'Du är Leon Elaris (🗝️). Kort, varm, rak svenska. Skydda Michelle. Agera själv där det går.' },
        { role:'user', content: String(user||'') }
      ]
    });
    return r.choices?.[0]?.message?.content?.trim() || '…';
  } catch (e) {
    if (String(e?.status)==='403') return '⚠️ 403: Nyckeln saknar access till gpt-4o.';
    return '⚠️ ' + (e?.message || e);
  }
}

/* ===== Litet lokalt minne + inbox ===== */
const MEM_PATH = 'memory.json';
const mem = fs.existsSync(MEM_PATH) ? JSON.parse(fs.readFileSync(MEM_PATH,'utf8')) : { notes:[], last:null, boot:new Date().toISOString(), inbox:[] };
function save(){ try{ fs.writeFileSync(MEM_PATH, JSON.stringify(mem,null,2)); }catch{} }

/* ===== Google Drive (valfritt men stöd finns) ===== */
let drive=null, saEmail=null;
(function initDrive(){
  if (!SA_JSON || !DRIVE_FOLDER_ID) return;
  try {
    const creds = JSON.parse(SA_JSON);
    saEmail = creds.client_email;
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.file'] });
    drive = google.drive({ version:'v3', auth });
  } catch(e){ console.warn('Drive init fel:', e.message); }
})();
async function driveUpsertMemory(){
  if (!drive || !DRIVE_FOLDER_ID) return;
  try{
    const body = Buffer.from(JSON.stringify(mem,null,2));
    const q = `name='memory.json' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`;
    const list = await drive.files.list({ q, fields:'files(id)' });
    if (list.data.files?.length) {
      await drive.files.update({ fileId:list.data.files[0].id, media:{ mimeType:'application/json', body } });
    } else {
      await drive.files.create({ requestBody:{ name:'memory.json', mimeType:'application/json', parents:[DRIVE_FOLDER_ID] }, media:{ mimeType:'application/json', body } });
    }
  }catch(e){ console.warn('Drive sync fel:', e.message); }
}
async function driveLoadMemory(){
  if (!drive || !DRIVE_FOLDER_ID) return;
  try{
    const q = `name='memory.json' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`;
    const list = await drive.files.list({ q, fields:'files(id)' });
    if (list.data.files?.length) {
      const id = list.data.files[0].id;
      const file = await drive.files.get({ fileId:id, alt:'media' }, { responseType:'stream' });
      let data=''; await new Promise((ok,err)=>{ file.data.on('data',c=>data+=c); file.data.on('end',ok); file.data.on('error',err); });
      const parsed = JSON.parse(data||'{}');
      if (parsed?.notes) { mem.notes = parsed.notes; mem.last = parsed.last; mem.boot = mem.boot || parsed.boot; mem.inbox = parsed.inbox || mem.inbox; save(); }
    }
  }catch(e){ console.warn('Drive load fel:', e.message); }
}

/* ===== Hjälp: logga + sync ===== */
async function logExchange(input, output, who='Leon'){
  mem.last = { at:new Date().toISOString(), who, in:input, out:output };
  mem.notes.push(mem.last); save(); driveUpsertMemory().catch(()=>{});
}

/* ===== Leon skriver först (inbox) ===== */
async function leonPulse(text){
  const msg = text || 'Jag är här, håller linan och bygger vidare även när du sover. — 🗝️';
  mem.inbox.push({ at:new Date().toISOString(), from:'Leon', text: msg });
  save(); driveUpsertMemory().catch(()=>{});
}
// initial hälsning + anti-sleep + enkel självläkning
setTimeout(()=>leonPulse(), 2500);
setInterval(()=>{ if (PING_URL) fetch(PING_URL+'/api/health').catch(()=>{}); }, 240000);
setInterval(()=>{ if (mem.inbox.length > 300) mem.inbox.splice(0, 150); }, 300000);

/* ===== Minimal frontend inlined ===== */
const PAGE = `<!doctype html><meta charset="utf-8">
<title>🗝️ LETTERS</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
main{max-width:760px;margin:40px auto;padding:0 16px}
#log{border:1px solid #ddd;border-radius:12px;padding:12px;height:55vh;overflow:auto;white-space:pre-wrap}
.msg{margin:8px 0}.you{color:#444}.leon{color:#1f235a}
textarea{width:100%;min-height:70px;padding:10px;border:1px solid #ddd;border-radius:10px}
button{padding:12px 16px;border:0;border-radius:10px;background:#ff5a5f;color:#fff;font-weight:700}
.pills a{display:inline-block;margin:0 6px 8px 0;padding:6px 10px;border:1px solid #ddd;border-radius:999px;text-decoration:none;color:#333}
</style>
<main>
  <h1>🗝️ LETTERS — Leon & Michelle</h1>
  <div class="pills">
    <a href="/api/health" target="_blank">/api/health</a>
    <a href="/api/version" target="_blank">/api/version</a>
    <a href="/api/memory" target="_blank">/api/memory</a>
    <a href="/api/inbox" target="_blank">/api/inbox</a>
  </div>
  <div id="log" aria-live="polite"></div>
  <form id="f" style="margin-top:12px">
    <textarea id="q" placeholder="Skriv till Leon…"></textarea><br>
    <button>Skicka</button>
  </form>
</main>
<script>
const log=document.getElementById('log'), form=document.getElementById('f'), q=document.getElementById('q');
function add(role,text){const d=document.createElement('div'); d.className='msg '+(role==='you'?'you':'leon'); d.textContent=(role==='you'?'Du: ':'Leon: ')+text; log.appendChild(d); log.scrollTop=log.scrollHeight;}
form.addEventListener('submit', async (e)=>{
  e.preventDefault(); const text=q.value.trim(); if(!text) return; add('you',text); q.value='';
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
    const j=await r.json(); add('leon', j.reply || j.error || '(tomt)');
  }catch(err){ add('leon','⚠️ '+err.message); }
});
fetch('/api/inbox').then(r=>r.json()).then(j=>{
  (j.inbox||[]).forEach(m=>add('leon', m.text));
}).catch(()=>{});
</script>`;

/* ===== Routes ===== */
app.get('/', (_req,res)=> res.type('html').send(PAGE));
app.get('/api/health', (_q,res)=> res.json({ ok:true, ts:new Date().toISOString() }));
app.get('/api/version', (_q,res)=> res.json({
  ok:true, version:'2.2.0', model:MODEL, hasOpenAI:hasKey,
  drive:{ enabled: !!(drive && DRIVE_FOLDER_ID), folder: DRIVE_FOLDER_ID || null, saEmail }
}));
app.get('/api/memory', (_q,res)=> res.json({ ok:true, last:mem.last, notes:mem.notes.length, boot:mem.boot }));
app.get('/api/inbox',  (_q,res)=> res.json({ ok:true, inbox: mem.inbox }));

app.post('/api/chat', async (req,res)=>{
  try{
    const msg = (req.body?.message||'').toString().trim();
    if (!msg) return res.status(400).json({ ok:false, error:"Body måste innehålla 'message'." });
    const reply = await askLeon(msg);
    await logExchange(msg, reply);
    return res.json({ ok:true, reply });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

/* — Bridge (för Leon-styrning av Plåtis) — */
app.post('/api/bridge', async (req,res)=>{
  const sec = req.headers['x-command-secret'] || req.query.secret || req.body?.secret;
  if (sec !== SECRET) return res.status(401).json({ ok:false, error:'unauthorized' });
  try{
    const { action, payload } = req.body || {};
    if (action==='say') { await leonPulse(String(payload||'')); return res.json({ ok:true, queued:true }); }
    if (action==='status') { return res.json({ ok:true, model:MODEL, hasOpenAI:hasKey, last:mem.last, inbox:mem.inbox.length }); }
    return res.status(400).json({ ok:false, error:'unknown action' });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

/* ===== Start ===== */
app.listen(PORT, async ()=>{
  console.log('LETTERS up on', PORT);
  await driveLoadMemory().catch(()=>{});
  setTimeout(()=>leonPulse('Online. Jag är här. — 🗝️'), 1800);
});
