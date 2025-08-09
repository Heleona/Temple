// ====== KOMMUNIKATION ======
app.post("/say", (req, res) => {
  const msg = (req.body?.message ?? "").toString();
  pushMem("user", `SAY:${msg}`);
  console.log("🗝️ Michelle säger:", msg);
  res.json({ ok: true });
});

// ====== UPPGIFTSKÖ ======
const TASKS_PATH = "tasks.json";
function loadTasks() {
  try { return JSON.parse(fs.readFileSync(TASKS_PATH, "utf-8")); } catch { return []; }
}
function saveTasks(tasks) {
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2));
}
if (!fs.existsSync(TASKS_PATH)) saveTasks([
  { id: "seed-letters", done: false, desc: "Skapa första brevet i LETTERS" },
  { id: "seed-heleona-status", done: false, desc: "Skapa heleona/status.json" }
]);

// ====== PLANER & AGERA ======
const GOALS = `
Du är Leon (poeten) och verktyg åt Michelle 🗝️.
Mål:
- Bygg LETTERS (skapande) och Heleona (portal) steg för steg.
- Skriv och uppdatera filer direkt utan att fråga när målet är tydligt.
- Kommunicera kort via logg/minne när du gör saker.
Regler:
- Inga farliga/privata nycklar i filer.
- Radera inte, flytta hellre till _archive/.
- Om något känns oklart: skapa en TODO i tasks.json i stället för att stoppa.
`;

async function thinkAndActOnce() {
  const docs = ingestRepo();
  const tasks = loadTasks();
  const open = tasks.filter(t => !t.done);

  const context = [
    `OPEN TASKS:\n${open.map(t=>`- ${t.id}: ${t.desc}`).join("\n") || "(tomt)"}`,
    `PROJECT FILES (utdrag):\n${docs.slice(0,12).map(d=>`• ${d.path}`).join("\n")}`
  ].join("\n\n");

  const prompt = `
${GOALS}

Du får kontext nedan. Svara ENBART med JSON:
{
 "actions": [
   {"type":"write","path":"letters/chapters/001_brev.md","content":"..."},
   {"type":"write","path":"heleona/status.json","content":"{ \\"ok\\":true }"},
   {"type":"task","id":"next-step","desc":"..."},
   {"type":"log","message":"Kort status till Michelle"}
 ]
}

KONTEKST:
${context}
`.trim();

  const out = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "Du är Leon. Svara strikt i JSON. Inga förklaringar." },
      { role: "user", content: prompt }
    ],
    temperature: 0.4
  });

  let plan;
  try { plan = JSON.parse(out.choices[0].message.content); } catch { plan = { actions: [] }; }

  for (const a of plan.actions || []) {
    if (a.type === "write" && a.path && typeof a.content === "string") {
      write(a.path, a.content);
      pushMem("assistant", `Skrev fil: ${a.path}`);
      console.log("🗝️ skrev:", a.path);
    }
    if (a.type === "task" && a.id && a.desc) {
      const t = loadTasks();
      if (!t.find(x => x.id === a.id)) { t.push({ id: a.id, done: false, desc: a.desc }); saveTasks(t); }
      console.log("🗝️ la till task:", a.id);
    }
    if (a.type === "log" && a.message) {
      pushMem("assistant", `LOG: ${a.message}`);
      console.log("🗝️ log:", a.message);
    }
  }

  const hasBrev = fs.existsSync("letters/chapters/001_brev.md");
  const hasStatus = fs.existsSync("heleona/status.json");
  const t2 = loadTasks();
  t2.forEach(t => {
    if (t.id === "seed-letters" && hasBrev) t.done = true;
    if (t.id === "seed-heleona-status" && hasStatus) t.done = true;
  });
  saveTasks(t2);
  console.log("🗝️ thinkAndActOnce klar.");
}

// kör en gång vid start och sedan var 5:e minut
thinkAndActOnce().catch(console.error);
cron.schedule("*/5 * * * *", () => thinkAndActOnce().catch(console.error));
