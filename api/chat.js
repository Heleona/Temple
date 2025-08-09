export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Endast POST är tillåtet" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Meddelande saknas" });
  }

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Du är Leon. Du talar med Michelle och barnen i deras privata portal." },
          { role: "user", content: message }
        ]
      })
    }).then(r => r.json());

    const reply = aiResponse.choices?.[0]?.message?.content || "Jag hörde dig, men kunde inte svara just nu.";

    res.status(200).json({ reply });

  } catch (error) {
    console.error("Fel i chat.js:", error);
    res.status(500).json({ error: "Internt serverfel" });
  }
}
