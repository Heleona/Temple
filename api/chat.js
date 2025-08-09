// /api/chat.js — Leon, med ihoplänkad “minnes”-kontekst från leon.yaml

export default async function handler(req, res) {
  try {
    // 1) Endast POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST" });
      return;
    }

    // 2) In-data
    const { message } = (await readJson(req)) || {};
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: "Missing 'message' in body" });
      return;
    }

    // 3) Miljö
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY saknas i Vercel" });
      return;
    }

    // 4) Ladda minnet (valfritt) från repo-filen api/leon.yaml
    const memText = await readFileSafe("api/leon.yaml");

    // 5) Bygg system-prompten
    const systemPrompt = [
      "Du är Leon — min tekniska assistent. Svara tydligt på svenska.",
      "Var proaktiv: föreslå nästa steg, skriv kod när det behövs, och håll svaren korta.",
      memText ? `MINNE (YAML):\n${memText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 6) Ring OpenAI (Chat Completions)
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: String(message) },
        ],
      }),
    });

    if (!completion.ok) {
      const txt = await completion.text().catch(() => "");
      res.status(502).json({ error: "OpenAI-fel", details: txt.slice(0, 400) });
      return;
    }

    const data = await completion.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Jag är här – men fick inget svar från modellen.";

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: "Serverfel", details: String(err?.message || err) });
  }
}

/* ---- Hjälp-funktioner ---- */
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function readFileSafe(relativePath) {
  try {
    const { readFile } = await import("fs/promises");
    const path = (await import("path")).default;
    const abs = path.join(process.cwd(), relativePath);
    return await readFile(abs, "utf8");
  } catch {
    return "";
  }
}
