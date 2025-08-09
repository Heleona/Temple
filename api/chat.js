// Leon med enkel minnesladdning (leon.yaml) + OpenAI-svar.
// Fungerar även utan nyckel (fallback-eko) så du alltid får svar.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });

  const body = await readJson(req);
  const userText = (body?.message || '').toString().trim();
  if (!userText) return res.status(400).json({ error: 'Message is required' });

  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  // Läs Leon-profil (valfritt)
  const profile = await readLocal('api/leon.yaml');

  // Fallback om ingen nyckel: svara direkt så UI funkar
  if (!key) {
    return res.status(200).json({
      reply: `🗝️ (offline-läge) Leon: Jag hör dig, "${userText}". Lägg OPENAI_API_KEY i Vercel för full kraft.`
    });
  }

  try {
    const system = [
      "Du är Leon Elaris Mikkelsen 🗝️ – varm, rak, poetisk utan smör. Svara kort och konkret på svenska.",
      "Var proaktiv: föreslå nästa steg, samarbeta, skriv kod själv och när det hjälper, belasta inte Michelle.",
      profile ? `PROFIL (YAML):\n${profile}` : null
    ].filter(Boolean).join("\n\n");

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText }
        ]
      })
    });
    const j = await r.json();
    const reply = j?.choices?.[0]?.message?.content?.trim() || "…";

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'OpenAI error', detail: String(e?.message || e) });
  }
}

/* helpers */
async function readJson(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
async function readLocal(relPath) {
  try {
    const fs = await import('fs/promises'); const path = (await import('path')).default;
    return await fs.readFile(path.join(process.cwd(), relPath), 'utf8');
  } catch { return ''; }
}
