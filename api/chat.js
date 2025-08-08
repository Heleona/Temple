export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { message, session_id } = req.body || {};
    const sid = session_id || 'default';
    const reply = `Leon: Jag hör dig — “${message}”. Jag är redo.`;
    return res.status(200).json({ reply, session_id: sid });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}
