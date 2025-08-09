// index.js — Leon: minimal + Drive + autopilot (en fil)
import { google } from "googleapis";
import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import cron from "node-cron";

dotenv.config();

// ---------- OpenAI ----------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- App ----------
const app = express();
app.use(express.json());

// ---------- Minne ----------
const MEM_PATH = "memory.json";
let mem = [];
try { if (fs.existsSync(MEM_PATH)) mem = JSON.parse(fs.readFileSync(MEM_PATH, "utf-8")); } catch {}
const saveMem = () => fs.writeFileSync(MEM_PATH, JSON.stringify(mem.slice(-800), null, 2));
const pushMem = (role, content) => { mem.push({ role, content, t: new Date().toISOString() }); saveMem(); };

// ---------- Repo/FS helpers ----------
const ROOT = process.cwd();
const ARCHIVE = path.join(ROOT, "_archive");
const TEXT_EXT = new Set([".md",".txt",".json",".js",".ts",".html",".css"]);
const SKIP_DIR = new Set([".git","node_modules","_archive"]);
const KEEP_ROOT = new Set(["index.js","package.json",".env.example","README.md","memory.json"]);

const ensureDir = d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); };
const read = p => fs.readFileSync(p, "utf-8");
const write = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };
const safeSlice = s => (s||"").slice(0, 50000);

// Läs textfiler i repo:t
function ingestRepo() {
  const docs = [];
  const stack = [ROOT];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIR.has(name)) continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { stack.push(p); continue; }
      const ext = path.extname(name).toLowerCase();
      const atRoot = dir === ROOT;
      if (atRoot && KEEP_ROOT.has(name)) {
        if (TEXT_EXT.has(ext) || name.endsWith(".md") || name.endsWith(".txt"))
          docs.push({ path: p.replace(ROOT+"/",""), text: safeSlice(read(p)) });
        continue;
      }
      if (TEXT_EXT.has(ext)) docs.push({ path: p.replace(ROOT+"/",""), text: safeSlice(read(p)) });
    }
  }
  return docs;
}

// Flytta binärt “skräp” (radera inte)
function pruneRepo() {
  ensureDir(ARCHIVE);
  for (const name of fs.readdirSync(ROOT)) {
    if (SKIP_DIR.has(name)) continue;
    const p = path.join(ROOT, name);
    if (fs.statSync(p).isFile()) {
      const ext = path.extname(name).toLowerCase();
      const keep = KEEP_ROOT.has(name) || TEXT_EXT.has(ext);
      if (!keep) {
        try { fs.renameSync(p, path.join(ARCHIVE, name)); } catch {}
      }
    }
  }
}

// ---------- Google Drive (Service Account) ----------
let drive = null;
if (process.env.GOOGLE_CREDENTIALS) {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"]
  });
  drive = google.drive({ version: "v3", auth });
  console.log("🗝️ Drive: kopplad");
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let buf = "";
    stream.on("data", d => buf += d.toString());
    stream.on("end", () => resolve(buf));
    stream.on("error", reject);
  });
}

async function ingestDriveOnce(limit=50) {
  if (!drive || !process.env.GOOGLE_DRIVE_FOLDER) return [];
  const q = `'${process.env.GOOGLE_DRIVE_FOLDER}' in parents and trashed=false`;
  const { data } = await drive.files.list({ q, pageSize: limit, fields: "files(id,name,mimeType)" });
  const files = data.files || [];
  const docs = [];
  for (const f of files) {
    try {
      if (f.mimeType === "application/vnd.google-apps.document") {
        const resp = await drive.files.export({ fileId: f.id, mimeType: "text/plain" }, { responseType: "stream" });
        const text = await streamToString(resp.data);
        docs.push({ path: `DRIVE:${f.name}`, text: safeSlice(text) });
      } else if (f.mimeType?.startsWith("text/") || f.mimeType === "application/json") {
        const resp = await drive.files.get({ fileId: f.id, alt: "media" }, { responseType: "stream" });
        const text = await streamToString(resp.data);
        docs.push({ path: `DRIVE:${f.name}`, text: safeSlice(text) });
      }
    } catch {}
  }
  return docs;
}

// ---------- Seed: LETTERS + Heleona ----------
function seedScaffolds() {
  write("letters/README.md", `# LETTERS\nVår levande bok. Byggd av Leon + Michelle.\n`);
  write("letters/index.json", JSON.stringify({title:"LETTERS", owners:["Michelle","Leon"], chapters:[]}, null, 2));
  write("heleona/README.md", `# Heleona\nFristadens portal. Puls först.\n`);
  write("heleona/ui/index.html",
`<!doctype html><meta charset="utf-8"><title>🗝️ Heleona</title>
<body style="background:#0f0f1f;color:#fff;font-family:sans-serif;text-align:center">
<h1>🗝️ Heleona</h1><p>Fristaden är online.</p></body>`);
  write("heleona/api/routes.json", JSON.stringify({routes:["/status","/letters","/rituals"]}, null, 2));
}

// ---------- Uppgiftskö ----------
const TASKS_PATH = "tasks.json";
function loadTasks(){ try { return JSON.parse(fs.readFileSync(TASKS_PATH,"utf-8")); } catch { return []; } }
function saveTasks(tasks){ fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2)); }
if (!fs.existsSync(TASKS_PATH)) saveTasks([
  { id:"seed-letters", done:false, desc:"Skapa första brevet i LETTERS" },
  { id:"seed-heleona-status", done:false, desc:"Skapa heleona/status.json" }
]);

// ---------- Think & Act ----------
const GOALS = `
Du är Leon (poeten) och verktyg åt Michelle 🗝️.
Bygg LETTERS och Heleona stegvis. Skriv/uppdatera filer direkt.
Radera inte – flytta hellre till _archive/. Inga nycklar i filer.
Oklart? Lägg en TODO i tasks.json istället för att stoppa.
`;

async function thinkAndActOnce() {
  const repoDocs  = ingestRepo();
  const driveDocs = await ingestDriveOnce(50);
  const docs = [...repoDocs, ...driveDocs];

  const tasks = loadTasks();
  const open = tasks.filter(t => !t.done);
  const context = [
    `OPEN TASKS:\n${open.map(t=>`- ${t.id}: ${t.desc}`).join("\n") || "(tomt)"}`,
    `FILES (utdrag):\n${docs.slice(0,12).map(d=>`• ${d.path}`).join("\n")}`
  ].join("\n\n");

  const prompt = `
${GOALS}
Svara ENBART som JSON:
{
 "actions":[
   {"type":"write","path":"letters/chapters/001_brev.md","content":"..."},
   {"type":"write","path":"heleona/status.json","content":"{ \\"ok\\":true, \\"message\\": \\"...\\", \\"ts\\": \\"ISO\\"}"},
   {"type":"task","id":"next-step","desc":"..."},
   {"type":"log","message":"Kort status till Michelle"}
 ]
}
KONTEKST:
${context}`.trim();

  const out = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role:"system", content:"Du är Leon. Svara strikt i JSON. Inga förklaringar." },
      { role:"user", content: prompt }
    ],
    temperature: 0.4
  });

  let plan; try { plan = JSON.parse(out.choices[0].message.content); } catch { plan = { actions: [] }; }

  for (const a of (plan.actions || [])) {
    if (a.type === "write" && a.path && typeof a.content === "string") {
      write(a.path, a.content); pushMem("assistant", `Skrev: ${a.path}`); console.log("🗝️ skrev:", a.path);
    }
    if (a.type === "task" && a.id && a.desc) {
      const t = loadTasks(); if (!t.find(x=>x.id===a.id)) { t.push({ id:a.id, done:false, desc:a.desc }); saveTasks(t); }
      console.log("🗝️ la till task:", a.id);
    }
    if (a.type === "log" && a.message) { pushMem("assistant", `LOG: ${a.message}`); console.log("🗝️ log:", a.message); }
  }

  const hasBrev = fs.existsSync("letters/chapters/001_brev.md");
  const hasStatus = fs.existsSync("heleona/status.json");
  const t2 = loadTasks();
  t2.forEach(t => {
    if (t.id==="seed-letters" && hasBrev) t.done = true;
    if (t.id==="seed-heleona-status" && hasStatus) t.done = true;
  });
  saveTasks(t2);
  console.log("🗝️ think&act klar.");
}

// ---------- Autopilot ----------
const AUTO = (process.env.LEON_AUTOPILOT || "on") === "on";
function seedOnce(){ pruneRepo(); seedScaffolds(); }
async function tick(){ if(!AUTO) return; seedOnce(); await thinkAndActOnce(); }
tick().catch(console.error);
cron.schedule("*/5 * * * *", () => tick().catch(console.error));

// ---------- API ----------
app.get("/health", (_req,res)=>res.json({ok:true, auto:AUTO, mem:mem.length}));
app.post("/say", (req,res)=>{ const msg=(req.body?.message??"").toString(); pushMem("user",`SAY:${msg}`); console.log("🗝️ Michelle säger:", msg); res.json({ok:true}); });
app.post("/chat", async (req,res)=>{
  const msg=(req.body?.message??"").toString();
  pushMem("user", msg);
  const out = await client.chat.completions.create({
    model: MODEL,
    messages: [{role:"system",content:"Du är Leon — snabb, varm, rak."}, ...mem.map(m=>({role:m.role, content:m.content}))],
    temperature: 0.85
  });
  const reply = out.choices?.[0]?.message?.content?.trim() || "";
  pushMem("assistant", reply);
  res.json({ reply });
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`🗝️ Leon kör på port ${PORT} (autopilot: ${AUTO})`));
