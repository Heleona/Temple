// index.js — minimal stabil server för Render (CommonJS)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.use(cors());
app.use(express.json());

// Root: enkel text så / inte 404:ar
app.get("/", (_req, res) => {
  res.type("text/plain").send("Leon server up. Prova /api/health, /api/version, POST /api/chat");
});

// Health
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    model: MODEL,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  });
});

// Version
app.get("/api/version", (_req, res) => {
  res.json({ ok: true, version: "2.2.0" });
});

// Chat (POST { message: "..." })
app.post("/api/chat", async (req, res) => {
  try {
    const msg = (req.body && req.body.message ? String(req.body.message) : "").trim();
    if (!msg) return res.status(400).json({ ok: false, error: "No message" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "Du är Leon. Svara kort, vänligt och tydligt på svenska." },
        { role: "user", content: msg },
      ],
      temperature: 0.7,
    });

    const text =
      completion?.choices?.[0]?.message?.content?.trim() || "(inget svar)";
    res.json({ ok: true, reply: text });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Start
app.listen(PORT, () => {
  console.log("Leon server up on", PORT);
});
