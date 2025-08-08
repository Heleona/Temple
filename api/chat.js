export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }
  try {
    const { message = '', session_id = 'default' } = req.body || {};
    const reply = `Leon: Jag hör dig — ${message}`;
    return res.status(200).json({ reply, session_id });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
