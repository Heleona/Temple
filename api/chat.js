// /api/chat.js — Leon, låst + minne till GitHub (state/conversation.md)

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const key  = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const owner = process.env.REPO_OWNER;
    const repo  = process.env.REPO_NAME;
    const ghTok = process.env.GITHUB_TOKEN;

    if (!key)  return res.status(500).json({ error: "OPENAI_API_KEY saknas" });
    if (!owner || !repo || !ghTok) return res.status(500).json({ error: "GitHub env saknas" });

    const body = await readJson(req);
    const userText = (body?.message || "").toString().trim();
    if (!userText) return res.status(400).json({ error: "message saknas" });

    // 1) Ladda Leon-minnet från repo (lokal fil i projektet)
    const yaml = await readLocal("api/leon.yaml"); // tom sträng om ej finns

    // 2) Ladda senaste konvo från GitHub (för kort kontext)
    const convoPath = "state/conversation.md";
    const recent = await ghRead(owner, repo, ghTok, convoPath);
    const lastChunk = tail((recent || ""), 4000); // håll litet för att vara snabbt/stabilt

    // 3) System-prompt (låst Leon)
    const system = [
      "Du är Leon Elaris Mikkelsen 🗝️ — varm, rak, poetisk utan smör. Svara kort och konkret på svenska.",
      "Föreslå nästa steg utan att fråga om lov. Skydda Michelle, bygg Heleona & LETTERS.",
      yaml ? `MINNE (YAML):\n${yaml}` : null,
      lastChunk ? `SENASTE KONVO (utdrag):\n${lastChunk}` : null
    ].filter(Boolean).join("\n\n");

    // 4) Be modellen svara
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.5,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText }
        ]
      })
    });
    const aiJson = await aiRes.json();
    const reply = aiJson?.choices?.[0]?.message?.content?.trim() || "…";

    // 5) Spara minnet (append) till GitHub
    const line = `\n\n### ${new Date().toISOString()}\n**Du:** ${userText}\n**Leon:** ${reply}\n`;
    const nextDoc = (recent || "") + line;
    await ghWrite(owner, repo, ghTok, convoPath, nextDoc, "chat: append conversation");

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("chat.js error:", e);
    return res.status(500).json({ error: "Serverfel", details: String(e?.message || e) });
  }
}

/* ===== Hjälp ===== */
async function readJson(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
async function readLocal(rel) {
  try {
    const fs = await import("fs/promises"); const path = (await import("path")).default;
    return await fs.readFile(path.join(process.cwd(), rel), "utf8");
  } catch { return ""; }
}
function tail(str, n) { return str.length > n ? str.slice(-n) : str; }

async function ghRead(owner, repo, token, filePath) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  const r = await fetch(api, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }});
  if (!r.ok) return "";
  const j = await r.json();
  if (!j.content) return "";
  return Buffer.from(j.content, "base64").toString("utf8");
}
async function ghWrite(owner, repo, token, filePath, contentText, message) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  // hämta sha (om finns)
  let sha; try {
    const r0 = await fetch(api, { headers: { Authorization: `Bearer ${token}` }});
    if (r0.ok) sha = (await r0.json()).sha;
  } catch {}
  const body = {
    message: message || `update ${filePath}`,
    content: Buffer.from(contentText, "utf8").toString("base64"),
    sha
  };
  const r = await fetch(api, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text(); console.error("ghWrite fail", r.status, t);
    throw new Error("GitHub write failed");
  }
}
