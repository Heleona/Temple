export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    owner: "Michelle 🗝️ + Leon",
    plan: [
      "Health & Heartbeat online",
      "Chat kopplad till Leon (OpenAI) med minne",
      "Koppla LETTERS och Heleona stegvis",
      "Automatisera bygg via /api/tick"
    ]
  });
}
