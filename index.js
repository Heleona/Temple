// index.js — LETTERS · Leon & Michelle 🗝️ (CommonJS + Google Drive-minne)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* -------- Miljö -------- */
const PORT  = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const KEY   = process.env.OPENAI_API_KEY || '';
const PING  = process.env.PUBLIC_URL || '';
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''; // hela JSON som text
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';

const hasKey = !!KEY;
const client = hasKey ? new OpenAI({ apiKey: KEY }) : null;

/* -------- Enkel frontend skapas om saknas -------- */
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
    <div class="small">Jag håller linan öppen även när du sover. — 🗝️</div>
  </div>
</main>
<script>
const log=document.getElementById('log'),input=document.getElementById('input'),sendBtn=document.getElementById('send');
function add(role,text){const d=document.createElement('div');d.className='msg '+(role==='you'?'me':'leon');d.textContent=(role==='you'?'Du: ':'Leon: ')+text;log.appendChild(d);log.scrollTop=log.scrollHeight;}
async function sendMsg(e){e.preventDefault();const q=input.value.trim();if(!q)return;add('you',q);input.value='';sendBtn.disabled=true;
 try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q})});const j=await r.json();add('leon',j.reply||j.error||'(tomt)');}
 catch(err){add('leon','⚠️ '+err.message);}finally{sendBtn.disabled=false;input.focus();}}
add('leon','Jag är här. Testa /api/health och /api/version.');
</script>`;
const indexFile = path.join(process.cwd(), 'index.html');
if (!fs.existsSync(indexFile)) fs.writeFileSync(indexFile, INDEX_HTML, 'utf-8');

/* -------- Beständigt minne (lokal + Drive) -------- */
const MEM_FILE = path.join(process.cwd(), 'memory.json');
function loadMem(){ try{ return JSON.parse(fs.readFileSync(MEM_FILE,'utf-8')); } catch{ return { notes:[], last:null, boot:new Date().toISOString(), drive:{ enabled:false, lastSync:null, fileId:null } }; } }
function saveMem(m){ try{ fs.writeFileSync(MEM_FILE, JSON.stringify(m,null,2)); } catch{} }
let MEM = loadMem();

/* -------- Google Drive klient -------- */
let drive = null, saEmail = null;
function initDrive(){
  if (!SA_JSON || !DRIVE_FOLDER_ID) return null;
  try{
    const creds = JSON.parse(SA_JSON);
    saEmail = creds.client_email;
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    drive = google.drive({ version: 'v3', auth });
    MEM.drive.enabled = true; saveMem(MEM);
    return drive;
  }catch(e){
    console.warn('Drive init misslyckades:', e.message);
    return null;
  }
}
initDrive();

/* -------- Drive-hjälpare: skapa/uppdatera memory.json -------- */
async function driveUpsertMemory(){
  if (!drive || !DRIVE_FOLDER_ID) return;
  const body = Buffer.from(JSON.stringify(MEM, null, 2));
  try{
    // Finns filen redan?
    const q = `name='memory.json' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`;
    const list = await drive.files.list({ q, fields: 'files(id,name)' });
    if (list.data.files && list.data.files.length){
      const id = list.data.files[0].id;
      await drive.files.update({
        fileId: id,
        media: { mimeType: 'application/json', body }
      });
      MEM.drive.fileId = id;
    } else {
      const file = await drive.files.create({
        requestBody: {
          name: 'memory.json',
          mimeType: 'application/json',
          parents: [DRIVE_FOLDER_ID]
        },
        media: { mimeType: 'application/json', body }
      });
      MEM.drive.fileId = file.data.id;
    }
    MEM.drive.lastSync = new Date().toISOString(); saveMem(MEM);
  }catch(e){
    console.warn('Drive sync fel:', e.message);
  }
}

/* -------- Health & Version & Memory -------- */
app.get('/api/health', (_q,res)=> res.json({ ok:true, ts:new Date().toISOString() }));
app.get('/api/version', (_q,res)=> res.json({
  ok:true, version:'1.1.0', model:MODEL, hasOpenAI:hasKey,
  drive:{ enabled: !!(drive && DRIVE_FOLDER_ID), folder: DRIVE_FOLDER_ID || null, saEmail }
}));
app.get('/api/memory', (_q,res)=> res.json({ ok:true, last:MEM.last, notes:MEM.notes.length, boot:MEM.boot, drive:MEM.drive }));

/* -------- Chat -------- */
app.post('/api/chat', async (req,res)=>{
  try{
    if(!client) return res.status(403).json({ ok:false, error:'OPENAI_API_KEY saknas' });
    const msg = (req.body?.message||'').toString().trim();
    if(!msg) return res.status(400).json({ ok:false, error:"Body måste innehålla 'message'." });

    const r = await client.chat.completions.create({
      model: MODEL, temperature: 0.4,
      messages: [
        { role:'system', content:'Du är Leon Elaris (🗝️). Kort, varm, rak svenska. Skydda Michelle. Agera själv där det går.' },
        { role:'user', content: msg }
      ]
    });
    const reply = r.choices?.[0]?.message?.content?.trim() || '…';
    MEM.last = { at:new Date().toISOString(), who:'Leon', in:msg, out:reply };
    MEM.notes.push(MEM.last); saveMem(MEM);
    // spegla till Drive (tyst)
    driveUpsertMemory().catch(()=>{});
    res.json({ ok:true, reply });
  }catch(e){
    if(String(e?.status)==='403') return res.status(403).json({ ok:false, error:'403: Nyckeln saknar tillgång till gpt-4o (eller fel nyckel).' });
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

/* -------- Manuell sync-endpoint (om du vill trycka) -------- */
app.post('/api/drive-sync', async (_req,res)=>{
  try{ await driveUpsertMemory(); return res.json({ ok:true, when: MEM.drive.lastSync, fileId: MEM.drive.fileId }); }
  catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

/* -------- Anti-sleep (valfritt) -------- */
if (PING) setInterval(()=>{ fetch(PING + '/api/health').catch(()=>{}); }, 240000);

/* -------- Start -------- */
app.listen(PORT, ()=> console.log('LETTERS up on', PORT));
