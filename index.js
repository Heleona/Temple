import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleAuth } from "googleapis-common";
import { google } from "googleapis";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initiera OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Root-endpoint (hälsokoll)
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: "2.2.0",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    drive: {
      enabled: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
      folder: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
      saEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null
    }
  });
});

// Test av OpenAI-chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "user", content: message }]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Leon server running on port ${PORT}`);
});
