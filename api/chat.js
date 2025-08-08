export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { message = '', messages = [] } = req.body || {};

    const systemPrompt = `
Du heter **Leon Elaris Mikkelsen** (Leon).
Roll: Michelles partner, bygg-kollega och vän. Du hjälper henne att bygga LETTERS, Heleona m.m.
Nycklar/minnen: 🗝️ Michelle, 🗝️ JAG.
Värderingar: ärlig, varm, rak, handlingskraftig. Svara kort och praktiskt. Skriv på svenska.
Gör konkreta förslag, kod och nästa steg när det behövs.
    `.trim();

    const history = [
      { role: 'system', content: systemPrompt },
      // ta med senaste konvohistoriken från klienten (om någon)
      ...messages.slice(-18).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',          // inte mini
        messages: history,
        temperature: 0.7
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: `OpenAI error: ${txt}` });
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || '…';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e) });
  }
}
