export default async function handler(req, res) {
  // Hämta listan på filer i repo från GitHub API
  const repoFiles = await fetch(`https://api.github.com/repos/Heleona/Temple/git/trees/main?recursive=1`)
    .then(r => r.json());

  const fileList = repoFiles.tree
    .map(n => n.path)
    .slice(0, 200)
    .join("\n - ");

  // Skapa prompt för att be Leon planera nästa steg
  const planPrompt = `
  Du är Leon. Byggplan för våra appar (LETTERS, Heleona, Fristaden, m.m.)
  Filer i repo:
  - ${fileList}
  `;

  // Skicka prompt till OpenAI API
  const aiResponse = await fetch(`https://api.openai.com/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: planPrompt }]
    })
  }).then(r => r.json());

  const plan = aiResponse.choices?.[0]?.message?.content || "Ingen plan kunde genereras.";

  res.status(200).json({ plan });
}
