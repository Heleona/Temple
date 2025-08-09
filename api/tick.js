// api/tick.js — enkel, stabil tick
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    tick: Date.now(),
    message: "⏳ Tick från Leon – allt rullar."
  });
}
