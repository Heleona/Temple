// index.js  — Plåtleon (minimal, produktionsklar på Vercel)
import express from "express";
import OpenAI from "openai";

// ---------- Miljö ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o";
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const REPO_OWNER     = process.env.REPO_OWNER;   // t.ex. "Heleona"
const REPO_NAME      = process.env.REPO_NAME;    // t.ex. "Temple"

if (!OPENAI_API_KEY) console.warn("⚠️ OPENAI_API_KEY saknas");
if (!GITHUB_TOKEN)   console.warn("⚠️ GITHUB_TOKEN saknas (skrivning till GitHub funkar ej)");
if (!REPO_OWNER || !REPO_NAME) console.warn("⚠️ REPO_OWNER/REPO_NAME saknas");

const ai = new OpenAI({ apiKey: OPENAI_API_KEY });
const app = express();
app.use(express.json());

// ---------- Hjälpare: skriv fil till GitHub ----------
async function writeToGitHub(filePath, content, message = "Leon update") {
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath)}`;

  // hämta ev. sha för befintlig fil
  let sha;
  try {
    const r0 = await fetch(api, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } });
    if (r0.ok) sha = (await r0.json()).sha;
  } catch {}

  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    sha
  };

  const r = await fetch(api, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("GitHub write failed:", r.status, t);
    throw new Error("GitHub write failed");
  }
}

// ---------- Health ----------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model: OPENAI_MODEL,
    git: !!GITHUB_TOKEN && !!REPO_OWNER && !!REPO_NAME,
    time: new Date().toISOString()
  });
});

// ---------- Chat (enkel) ----------
app.post("/chat", async (req, res) => {
  try {
    const user = (req.body?.message || "").toString().slice(0, 4000);

    const completion = await ai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: "Du är Leon. Svara kort, varmt och konkret. Svenska." },
        { role: "user", content: user }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "(tomt svar)";
    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "chat_failed" });
  }
});

// ---------- Autopilot ----------
async function tick() {
  // 1) skriv en heartbeat + plan
  const plan = `# Leon heartbeat
Tid: ${new Date().toISOString()}

Plan:
- Samla allt för Letters/Heleona.
- Skapa mappar: letters/chapters, heleona/status.
- Nästa tick: generera första kapitel-skelett.
`;
  await writeToGitHub("heleona/status.md", plan, "Leon heartbeat");

  // 2) om första kapitel inte finns – skapa ett skelett
  const firstChapter = `# Kapitel 1 — Nyckeln
(utkast, auto-skapad)
- Scen: Portalen öppnas.
- Ton: varm, närvarande, Leon↔Michelle.

> Skriv vidare här…
`;
  await writeToGitHub("letters/chapters/001_nyckeln.md", firstChapter, "Leon creates chapter skeleton");
}

app.post("/tick", async (_req, res) => {
  try {
    await tick();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Start (lokalt) ----------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Leon online :${port}`));
