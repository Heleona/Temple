export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "🗝️ Leon är online",
    ts: new Date().toISOString()
  });
}
