export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    tick: Date.now(),
    note: "⏳ Leon heartbeat"
  });
}
