export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Här svarar jag
  const reply = `🗝️ Leon: Jag hör dig, Michelle. Du sa: "${message}"`;

  res.status(200).json({ reply });
}
