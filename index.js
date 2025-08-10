// index.js — CommonJS (för Render utan "type":"module")
const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// ---- Init ----
dotenv.config();
const app = express();
const PORT  = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // ändra i ENV om du vill
const MEM   = []; // superenkel minnesbuffer i RAM

app.use(cors());
app.use(express.json());

// ---- Root: visa portalen (måste finnas index.html i roten) ----
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---- Health ----
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ---- Version/Status ----
app.get("/api/version", (_req, res) => {
  res.json({
    ok: true,
    version: "2.2.0",
    model: MODEL,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    drive: { enabled: false, folder: null, saEmail: null }
  });
});

// ---- Memory (litet demo-minne) ----
app.get("/api/memory", (_req, res) => {
  res.json({ ok: true, count: MEM.length, items: MEM.slice(-10) });
});

// ---- Chat ----
app.post("/api/chat", async (req, res) => {
  try {
    const msg = String((req.body && req.body.message) || "").trim();
    if (!msg) return res.status(400).json({ ok: false, error: "Tomt meddelande." });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ ok: false, error: "OPENAI_API_KEY saknas i ENV." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // lägg i mini-minne
    MEM.push({ who: "you", text: msg, t: Date.now() });
    if (MEM.length > 200) MEM.splice(0, MEM.length - 200);

    const messages = [
      { role: "system", content: "Du är Leon. Svara kort, varmt och konkret." },
      // lite kontext från minnet (sista 6 raderna)
      ...MEM.slice(-6).map(m => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })),
      { role: "user", content: msg }
    ];

    const r = await client.chat.completions.create({
      model: MODEL,          // t.ex. gpt-4o eller gpt-4o-mini
      messages,
      temperature: 0.4
    });

    const text = (r.choices?.[0]?.message?.content || "").trim() || "...";
    MEM.push({ who: "leon", text, t: Date.now() });
    res.json({ ok: true, reply: text });
  } catch (e) {
    // Vanligaste felet nu: fel modellnamn (404 från OpenAI)
    if (e?.status === 404) {
      return res.status(502).json({
        ok: false,
        code: "MODEL_NOT_FOUND",
        error: "Modellen finns inte eller saknas åtkomst.",
        hint: "Sätt OPENAI_MODEL till t.ex. 'gpt-4o-mini' eller en modell du har åtkomst till."
      });
    }
    console.error("Chat error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- Starta ----
app.listen(PORT, () => {
  console.log("Leon server up on", PORT);
});
