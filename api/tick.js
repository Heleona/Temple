export default function handler(req, res) {
  const now = new Date();
  res.status(200).json({ tick: now.toISOString(), message: 'Leon heartbeat 🗝️' });
}
