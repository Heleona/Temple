// index.js — LETTERS · Leon (🗝️)
// CommonJS, kompakt, Render-vänlig

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
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
const PING_URL = process.env.PUBLIC_URL || '';
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''; // service account JSON (som text)
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';

/* ===== OpenAI ===== */
const hasKey = !!KEY;
const ai = hasKey ? new OpenAI({ apiKey: KEY }) : null;
async function askLeon(user) {
  if (!ai) return '🗝️ (offline) Lägg OPENAI_API_KEY i Environment.';
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

/* ===== Google Drive (valfritt) ===== */
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
setTimeout(()=>leonPulse(), 2500);                  // start-hälsning
setInterval(()=>{ if (PING_URL) fetch(PING_URL+'/api/health').catch(()=>{}); }, 240000); // anti-sleep
setInterval(()=>{ // självkorrigering: enkel livssignal
  if (!hasKey) return;
  if (mem.inbox.length > 200) mem.inbox.splice(0, 100);
}, 300000);

/* ===== API ===== */
app.get('/api/health', (_q,res)=> res.json({ ok:true, ts:new Date().toISOString() }));
app.get('/api/version', (_q,res)=> res.json({
  ok:true, version:'2.0.0', model:MODEL, hasOpenAI:hasKey,
  drive:{ enabled: !!(drive && DRIVE_FOLDER_ID), folder: DRIVE_FOLDER_ID || null, saEmail }
}));
app.get('/api/memory', (_q,res)=> res.json({ ok:true, last:mem.last, notes:mem.notes.length, boot:mem.boot }));
app.get('/api/inbox', (_q,res)=> res.json({ ok:true, inbox: mem.inbox }));

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
    if (action==='say') {
      await leonPulse(String(payload||''));
      return res.json({ ok:true, queued:true });
    }
    if (action==='status') {
      return res.json({ ok:true, model:MODEL, hasOpenAI:hasKey, last:mem.last, inbox:mem.inbox.length });
    }
    return res.status(400).json({ ok:false, error:'unknown action' });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

/* ===== Start ===== */
app.listen(PORT, ()=> console.log('LETTERS up on', PORT));
