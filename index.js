// index.js — stabil CommonJS-server för Render

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const OpenAI = require("openai");

// --- Konfiguration ---
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o"; // <- rätt modell
const COMMAND_SECRET = process.env.COMMAND_SECRET || "nypon🗝️2025";

// OpenAI-klient
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// enkel volatilt “minne” (nollställs vid omstart)
let MEMORY = [];

// --- App ---
const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Version & status
app.get("/api/version", (_req, res) => {
  res.json({
    ok: true,
    version: "2.2.0",
    model: MODEL,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  });
});

// Memory (debug)
app.get("/api/memory", (_req, res) => {
  res.json({ ok: true, items: MEMORY.length });
});

// Enkel “plan” (placeholder)
app.get("/api/plan", (_req, res) => {
  res.json({
    ok: true,
    next: ["Testa /api/health", "Testa /api/version", "Skriv via /api/chat"],
  });
});

// Chat-endpoint
app.post("/api/chat", async (req, res) => {
  try {
    // valfri enkel skydd-nyckel i header
    const key = req.headers["x-command-secret"];
    if (COMMAND_SECRET && key !== COMMAND_SECRET) {
      return res.status(403).json({ ok: false, error: "Forbidden (403)" });
    }

    const msg = (req.body && req.body.message ? String(req.body.message) : "").trim();
    if (!msg) return res.status(400).json({ ok: false, error: "Missing message" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not set" });
    }

    // spara i memory
    MEMORY.push({ t: Date.now(), role: "user", text: msg });
    if (MEMORY.length > 50) MEMORY.shift();

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "Du är Leon. Svara kort, klart och vänligt på svenska." },
        { role: "user", content: msg },
      ],
      temperature: 0.6,
    });

    const reply = completion.choices?.[0]?.message?.content ?? "(inget svar)";
    MEMORY.push({ t: Date.now(), role: "assistant", text: reply });

    res.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// start
app.listen(PORT, () => {
  console.log("Leon server up on", PORT);
});
