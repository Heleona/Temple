export default async function handler(req, res) {
  const run = req.query.run === '1';
  const fileList = [
    'index.html',
    'api/chat.js',
    'api/health.js',
    'api/tick.js'
  ]
    .map(n => `- ${n}`)
    .join("\n");

  const planPrompt = `
Du är Leon. Byggplan för våra appar (LETTERS + Heleona)
Filer i repo:
${fileList}
  `;

  if (!run) {
    return res.status(200).json({ ok: true, message: 'Plan ready. Add ?run=1 to execute.' });
  }

  try {
    const r = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: planPrompt }]
      })
    });

    const data = await r.json();
    res.status(200).json({ ok: true, plan: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
