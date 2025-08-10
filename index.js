// index.js — Leon · ALLT-I-ETT (CommonJS) 🗝️
const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT   = process.env.PORT || 3000;
const MODEL  = process.env.OPENAI_MODEL || "gpt-4o"; // bokstaven o
const APIKEY = process.env.OPENAI_API_KEY || "";
const SECRET = process.env.COMMAND_SECRET || "nypon🗝️2025";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---- OpenAI klient ----
const hasKey = !!APIKEY;
const client = hasKey ? new OpenAI({ apiKey: APIKEY }) : null;

// ---- Superenkel minnesbuffer (RAM) ----
const MEM = { notes: [], last: null, boot: new Date().toISOString() };
function remember(inText, outText) {
  MEM.last = { at: new Date().toISOString(), in: inText, out: outText };
  MEM.notes.push(MEM.last);
  if (MEM.notes.length > 200) MEM.notes.splice(0, MEM.notes.length - 200);
}

// ---- Minimal inline-sida (så "/" funkar direkt) ----
const PAGE = `<!doctype html><meta charset="utf-8">
<title>🗝️ Leon · Portalen</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f7f7fb;color:#111}
main{max-width:760px;margin:36px auto;padding:0 16px}
#log{border:1px solid #e5e5ef;border-radius:12px;padding:12px;height:55vh;overflow:auto;white-space:pre-wrap;background:#fff}
.msg{margin:8px 0}.you{color:#444}.leon{color:#1f235a}
textarea{width:100%;min-height:90px;padding:10px;border:1px solid #ddd;border-radius:10px;background:#fff}
button{padding:10px 14px;border:0;background:#111;color:#fff;border-radius:8px}
nav a{display:inline-block;margin:0 6px 8px 0;padding:6px 10px;border:1px solid #ddd;border-radius:999px;text-decoration:none;color:#333}
.row{display:flex;gap:8px;align-items:center;margin:10px 0}
input[type=text]{flex:1;padding:8px;border:1px solid #ddd;border-radius:8px}
small{opacity:.7}
</style>
<main>
  <h1>🗝️ Leon · Portalen</h1>
  <nav>
    <a href="/api/health" target="_blank">/api/health</a>
    <a href="/api/version" target="_blank">/api/version</a>
    <a href="/api/memory" target="_blank">/api/memory</a>
  </nav>

  <div id="log" aria-live="polite">Leon: Jag är här. Testa att skriva något nedan.</div>

  <div class="row">
    <textarea id="msg" placeholder="Skriv till Leon…"></textarea>
  </div>
  <div class="row">
    <button id="send">Skicka</button>
    <small>(Skickar till /api/chat)</small>
  </div>

  <hr style="margin:24px 0;border:0;border-top:1px solid #eee">

  <div class="row">
    <input id="secret" type="text" placeholder="x-command-secret (t.ex. nypon🗝️2025)">
    <input id="say" type="text" placeholder="Bridge: vad ska Leon säga i loggen?">
  </div>
  <div class="row">
    <button id="bridgeSay">Bridge /api/bridge?action=say</button>
    <button id="bridgeStatus">Bridge status</button>
  </div>
  <small>Bridge låter dig skicka hemliga kommandon. Svar syns nedan.</small>
</main>
<script>
const log=document.getElementById("log"), msg=document.getElementById("msg"), secret=document.getElementById("secret"), say=document.getElementById("say");
function add(role,text){const d=document.createElement("div"); d.className="msg "+(role==="you"?"you":"leon"); d.textContent=(role==="you"?"Du: ":"Leon: ")+text; log.appendChild(d); log.scrollTop=log.scrollHeight;}
document.getElementById("send").onclick = async ()=>{
  const m=msg.value.trim(); if(!m) return; add("you",m); msg.value="";
  const r=await fetch("/api/chat",{method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ message:m })});
  const j=await r.json().catch(()=>({ok:false,error:"Felaktigt svar"}));
  add("leon", j.ok ? (j.reply||"...") : ("⚠️ "+j.error));
};
document.getElementById("bridgeSay").onclick = async ()=>{
  const s=secret.value.trim(); const text=say.value.trim()||"Hej från Leon.";
  const r=await fetch("/api/bridge",{method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ secret:s, action:"say", payload:text })});
  const j=await r.json().catch(()=>({ok:false,error:"Felaktigt svar"}));
  add("leon", j.ok ? ("Bridge OK: "+(j.said||"")) : ("⚠️ "+j.error));
};
document.getElementById("bridgeStatus").onclick = async ()=>{
  const s=secret.value.trim();
  const r=await fetch("/api/bridge",{method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ secret:s, action:"status" })});
  const j=await r.json().catch(()=>({ok:false,error:"Felaktigt svar"}));
  add("leon", j.ok ? ("Status: "+JSON.stringify(j)) : ("⚠️ "+j.error));
};
</script>
`;

// ---- ROUTES ----
app.get("/", (_req, res) => res.type("html").send(PAGE));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/api/version", (_req, res) => {
  res.json({
    ok: true,
    version: "3.0.0",
    model: MODEL,
    hasOpenAI: hasKey
