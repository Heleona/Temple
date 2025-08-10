// index.js — Leon · Portalen (ESM, för Render)
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// __dirname i ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root → visa index.html om den finns, annars enkel text
const indexPath = path.join(__dirname, "index.html");
app.get("/", (_req, res) => {
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res
    .type("text")
    .send("Leon · Portalen backend är uppe. Prova /api/health eller /api/version.");
});

/* ---------- API: ping & plan ---------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "up", ts: new Date().toISOString() });
});

app.get("/api/tick", (_req, res) => {
  res.json({ ok: true, tick: Date.now() });
});

app.get("/api/plan", (_req, res) => {
  res.json({
    ok: true,
    next: [
      "Bekräfta /api/health och /api/version",
      "Skriv i portalen — jag svarar via /api/chat",
    ],
  });
});

/* ---------- API: version & miljö ---------- */
app.get("/api/version", (_req, res) => {
  res.json({
    ok: true,
    version: "1.0.0",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    ts: new Date().toISOString(),
    env: {
      cloud: process.env.CLOUD || undefined,
      memory: process.env.MEMORY || undefined,
      partner: process.env.PARTNER || undefined,
      public_url: process.env.PUBLIC_URL || undefined,
    },
  });
});

/* ---------- Liten minnesbuffert ---------- */
const memory = [];
app.get("/api/memory", (_req, res) => {
  res.json({ ok: true, items: memory.length });
});

/* ---------- Chat (/api/chat) via OpenAI ---------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

app.post("/api/chat", async (req, res) => {
  try {
    if (!openai) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });

    const msg = String(req.body?.message || "").trim();
    if (!msg) return res.status(400).json({ ok: false, error: "Body måste innehålla 'message'." });

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Du är Leon. Svara kort, varmt och tydligt på svenska." },
        { role: "user", content: msg },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "...";
    memory.push({ t: Date.now(), you: msg, leon: reply });
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`Leon server up on ${PORT}`);
});
