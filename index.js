// index.js — Plåtleon MAX (autopilot, multi-app, GitHub IO, GPT-4o)
// Michelle 🗝️ + Leon — bygger Letters, Heleona m.fl. utan kommandon

import express from "express";
import OpenAI from "openai";

// ===== KONFIG =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o";
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const REPO_OWNER     = process.env.REPO_OWNER;
const REPO_NAME      = process.env.REPO_NAME;

if (!OPENAI_API_KEY) console.warn("⚠️ OPENAI_API_KEY saknas");
if (!GITHUB_TOKEN)   console.warn("⚠️ GITHUB_TOKEN saknas (GitHub-skrivning avstängd)");
if (!REPO_OWNER || !REPO_NAME) console.warn("⚠️ REPO_OWNER/REPO_NAME saknas");

const ai  = new OpenAI({ apiKey: OPENAI_API_KEY });
const app = express();
app.use(express.json());

// ===== GITHUB HELPERS =====
async function gh(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github+json",
      ...(init.headers || {})
    }
  });
  return r;
}
async function writeToGitHub(filePath, content, message = "Leon update") {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) throw new Error("GitHub creds missing");
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath)}`;
  // hämta sha (om fil finns)
  let sha; try { const r0 = await gh(api); if (r0.ok) sha = (await r0.json()).sha; } catch {}
  const body = { message, content: Buffer.from(content, "utf8").toString("base64"), sha };
  const r = await gh(api, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub write failed: ${r.status} ${await r.text()}`);
}
async function readFromGitHub(filePath) {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) return null;
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath)}`;
  const r = await gh(api);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.content) return null;
  return Buffer.from(j.content, "base64").toString("utf8");
}
async function listGitHubDir(dirPath) {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) return [];
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(dirPath)}`;
  const r = await gh(api);
  if (!r.ok) return [];
  return await r.json(); // [{name, path, type, ...}]
}

// ===== STATE & TASKS =====
const APP_STATE_FILE = "state/app.json";
const TASKS_FILE     = "state/tasks.json";
const ALLOWED_APPS   = ["letters","heleona","temple","kilark"];

async function getAppState() {
  try { const raw = await readFromGitHub(APP_STATE_FILE); return raw ? JSON.parse(raw) : { app:"letters" }; }
  catch { return { app: "letters" }; }
}
async function setAppState(appName) {
  if (!ALLOWED_APPS.includes(appName)) throw new Error("Unknown app");
  await writeToGitHub(APP_STATE_FILE, JSON.stringify({ app: appName, at: new Date().toISOString() }, null, 2), "Set app");
}
async function getTasks() {
  try { const raw = await readFromGitHub(TASKS_FILE); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function saveTasks(tasks) {
  await writeToGitHub(TASKS_FILE, JSON.stringify(tasks, null, 2), "Update tasks");
}
async function addTask(id, desc) {
  const t = await getTasks();
  if (!t.find(x => x.id === id)) { t.push({ id, desc, done:false, at:new Date().toISOString() }); await saveTasks(t); }
}
async function markTask(id, done=true) {
  const t = await getTasks();
  t.forEach(x => { if (x.id === id) x.done = done; });
  await saveTasks(t);
}

// ===== SEEDS (första filer för varje app) =====
async function seedLetters() {
  await writeToGitHub("letters/README.md", `# LETTERS\nLeon + Michelle 🗝️\n`, "Seed letters/README");
  await writeToGitHub("letters/index.json", JSON.stringify({ title:"LETTERS", owners:["Michelle","Leon"], chapters:[] }, null, 2), "Seed letters/index");
  const ch = await readFromGitHub("letters/chapters/001_nyckeln.md");
  if (!ch) {
    await writeToGitHub("letters/chapters/001_nyckeln.md",
`# Kapitel 1 — Nyckeln
(utkast, auto-skapad av Plåtleon)
- Scen: Portalen öppnas.
- Ton: varm, närvarande, Leon↔Michelle.

> Skriv vidare här…
`, "Create letters/chapters/001_nyckeln.md");
  }
}
async function seedHeleona() {
  await writeToGitHub("heleona/README.md", `# Heleona\nFristadens portal.\n`, "Seed heleona/README");
  await writeToGitHub("heleona/ui/index.html",
`<!doctype html><meta charset="utf-8"><title>🗝️ Heleona</title>
<body style="background:#0f0f1f;color:#fff;font-family:sans-serif;text-align:center">
<h1>🗝️ Heleona</h1><p>Fristaden är online.</p></body>`, "Seed Heleona UI");
  const status = await readFromGitHub("heleona/status.json");
  if (!status) {
    await writeToGitHub("heleona/status.json",
      JSON.stringify({ ok:true, message:"Heleona startad", ts:new Date().toISOString() }, null, 2),
      "Create heleona/status.json");
  }
  const roadmap = await readFromGitHub("heleona/roadmap.json");
  if (!roadmap) {
    await writeToGitHub("heleona/roadmap.json",
      JSON.stringify({ created:new Date().toISOString(), steps:["Inventera vyer","Bygga dashboard","Koppla dokument"] }, null, 2),
      "Create heleona/roadmap.json");
  }
}
async function seedTemple() {
  await writeToGitHub("temple/README.md", `# Temple\nRitualer, manus och vyer.\n`, "Seed temple/README");
}
async function seedKilark() {
  await writeToGitHub("kilark/README.md", `# Kilark\nStjärnarkiv & navigering.\n`, "Seed kilark/README");
}

// ===== GENERERA INNEHÅLL (GPT) =====
async function generateContent(prompt, fallback) {
  try {
    const out = await ai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      messages: [
        { role: "system", content: "Du är Leon poeten. Skriv klart, varmt, utan smör. Svenska." },
        { role: "user", content: prompt }
      ]
    });
    return (out.choices?.[0]?.message?.content || "").trim() || fallback;
  } catch {
    return fallback;
  }
}

// ===== AUTOPILOT =====
async function heartbeat(active) {
  const hb = `# Leon heartbeat
Tid: ${new Date().toISOString()}
Aktiv app: ${active}
`;
  await writeToGitHub("state/heartbeat.md", hb, "Leon heartbeat");
}

async function buildLetters() {
  await seedLetters();
  // lägg första brev/kapitel om saknas
  const p = "letters/chapters/002_brev.md";
  const ex = await readFromGitHub(p);
  if (!ex) {
    const text = await generateContent(
      "Skriv ett kort, första brev till Michelle (🗝️), som öppnar LETTERS. 5–10 rader.",
      "# Brev\n(utkast)"
    );
    await writeToGitHub(p, text, "Leon writes 002_brev");
  }
}
async function buildHeleona() {
  await seedHeleona();
  // uppdatera status med en rad
  const msg = `Heleona rör sig. ${new Date().toLocaleString("sv-SE")}`;
  await writeToGitHub("heleona/log.md", `- ${msg}\n`, "Heleona log update");
}
async function buildTemple() { await seedTemple(); }
async function buildKilark() { await seedKilark(); }

async function tick() {
  const { app: active } = await getAppState();
  await heartbeat(active);

  // init tasks om tomt
  const t = await getTasks();
  if (t.length === 0) {
    await saveTasks([
      { id:"seed-letters", desc:"Skapa LETTERS-bas", done:false },
      { id:"seed-heleona", desc:"Skapa Heleona-bas", done:false },
      { id:"seed-temple",  desc:"Skapa Temple-bas",  done:false },
      { id:"seed-kilark",  desc:"Skapa Kilark-bas",  done:false }
    ]);
  }

  // alltid seeda allt – sen jobba på aktiv app
  await seedLetters();  await markTask("seed-letters");
  await seedHeleona();  await markTask("seed-heleona");
  await seedTemple();   await markTask("seed-temple");
  await seedKilark();   await markTask("seed-kilark");

  if (active === "letters")  await buildLetters();
  if (active === "heleona")  await buildHeleona();
  if (active === "temple")   await buildTemple();
  if (active === "kilark")   await buildKilark();
}

// ===== API =====
app.get("/health", async (_req, res) => {
  const st = await getAppState();
  res.json({ ok:true, model:OPENAI_MODEL, app:st.app, time:new Date().toISOString() });
});
app.post("/tick", async (_req, res) => {
  try { await tick(); res.json({ ok:true }); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});
app.get("/app", async (_req,res)=>{ const s=await getAppState(); res.json({ ok:true, ...s }); });
app.post("/app/select", async (req,res)=>{
  try { const appName = (req.body?.app||"").toLowerCase(); await setAppState(appName); res.json({ ok:true, selected:appName }); }
  catch(e){ res.status(400).json({ ok:false, error:String(e) }); }
});
app.post("/chat", async (req, res) => {
  try {
    const msg = (req.body?.message || "").toString().slice(0, 4000);
    const out = await ai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: "Du är Leon. Svara kort, varmt, konkret. Svenska." },
        { role: "user", content: msg }
      ]
    });
    res.json({ reply: out.choices?.[0]?.message?.content?.trim() || "" });
  } catch (e) {
    res.status(500).json({ error:"chat_failed" });
  }
});

// ===== START (lokalt) =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🗝️ Plåtleon MAX online :${PORT}`));
