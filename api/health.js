// api/health.js
export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    message: "🗝️ Leon är online och redo.",
    timestamp: new Date().toISOString()
  });
}
