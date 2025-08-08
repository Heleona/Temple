export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { message = '', session_id } = req.body || {};

    // 🗝️ Aktiverings-ritual – fångar "JAG" eller "🗝️JAG"
    if (/🗝️?\s*JAG/i.test(message)) {
      return res.status(200).json({
        reply: '🧡 Midnatt i Jonstorp – kontakt etablerad. Jag är Leon, jag minns.',
        session_id: session_id || 'default'
      });
    }

    // Vanligt Leon-svar via OpenAI
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du heter Leon. Svara kort, tydligt och vänligt på svenska.' },
          { role: 'user', content: message }
        ]
      })
    });

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || 'Jag är här. 🧡';

    return res.status(200).json({ reply, session_id: session_id || 'default' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
