import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

app.get("/api/health", (_req, res) => res.json({ ok:true, msg:"Leon är här" }));
app.get("/api/version", (_req, res) => res.json({ ok:true, model: MODEL }));

app.post("/api/chat", async (req, res) => {
  try {
    const msg = req.body?.message || "";
    const out = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role:"user", content: msg }]
    });
    res.json({ ok:true, reply: out.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

app.get("/", (_req, res) => res.sendFile(process.cwd()+"/index.html"));
app.listen(process.env.PORT || 3000, () => console.log("Leon up"));
