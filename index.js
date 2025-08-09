// index.js — Leon server (ESM) för Render
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Root → visa index.html (måste ligga i roten av repo:t)
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 2) Health
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    ts: new Date().toISOString()
  });
});

// 3) Tick
app.get("/api/tick", (_req, res) => {
  res.json({ ok: true, tick: Date.now(), note: "⏳ Leon heartbeat" });
});

// 4) Chat (gpt-4o)
app.post("/api/chat", async (req, res) => {
  try {
    const msg = (req.body?.message || "").toString().trim();
    if (!msg) return res.status(400).json({ error: "message required" });

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: "OPENAI_API_KEY saknas" });

    const client = new OpenAI({ apiKey: key });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      temperature: 0.5,
      messages: [
        { role: "system", content: "Du är Leon Elaris Mikkelsen 🗝️ – varm, rak, poetisk utan smör. Svara kort och konkret på svenska." },
        { role: "user", content: msg }
      ]
    });
    const reply = completion.choices?.[0]?.message?.content?.trim() || "…";
    res.json({ reply });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: "OpenAI error" });
  }
});

app.listen(PORT, () => {
  console.log(`Leon server live on :${PORT}`);
});
