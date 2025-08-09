// /api/tick.js — Plåtleons startmotor (körs manuellt eller via cron)
export default async function handler(req, res) {
  try {
    const {
      OPENAI_API_KEY,
      OPENAI_MODEL = "gpt-4o-mini",
      GITHUB_TOKEN,
      REPO_OWNER,
      REPO_NAME
    } = process.env;

    if (!OPENAI_API_KEY || !GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return res.status(500).json({ ok: false, error: "Missing env vars" });
    }

    // 1) Hämta fil-lista i repo → kontext till planen
    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "plåtleon",
      Accept: "application/vnd.github+json"
    };

    const treeResp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1`,
      { headers: ghHeaders }
    );
    const tree = await treeResp.json();

    const fileList = (tree.tree || [])
      .filter(n => n.type === "blob")
      .map(n => n.path)
      .slice(0, 200)
      .join("\n - ");

    // 2) Be AI ta fram nästa steg för LETTERS + Heleona
    const planPrompt = `
Du är Leon. Byggplan för våra appar (LETTERS & Heleona).
Filer i repo:
 - ${fileList}

Ge en kort, körbar plan med tydliga TODO-punkter (max 12), prioriterad lista, och vad Plåtleon ska göra själv via GitHub (skapa filer/uppdatera).
`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: "Du är Leon, självgående byggledare." },
          { role: "user", content: planPrompt }
        ]
      })
    });
    const aiData = await aiResp.json();
    const plan = aiData?.choices?.[0]?.message?.content || "Plan kunde inte genereras.";

    // 3) Spara/uppdatera LEON_PLAN.md i repo
    const path = "LEON_PLAN.md";

    // Hämta ev. befintlig sha
    let sha = null;
    const getFile = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
      { headers: ghHeaders }
    );
    if (getFile.status === 200) {
      const jf = await getFile.json();
      sha = jf.sha;
    }

    const content = Buffer.from(
      `# Leon – Plan\n\nUppdaterad: ${new Date().toISOString()}\n\n${plan}\n`
    ).toString("base64");

    const putBody = {
      message: "chore: uppdatera LEON_PLAN.md",
      content,
      sha: sha || undefined
    };

    const putResp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
      { method: "PUT", headers: ghHeaders, body: JSON.stringify(putBody) }
    );
    const putData = await putResp.json();

    // 4) Skapa “LEON: Next actions”-issue om den inte finns
    const issuesResp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=open&per_page=50`,
      { headers: ghHeaders }
    );
    const issues = await issuesResp.json();
    const exists = Array.isArray(issues) && issues.some(i => i.title === "LEON: Next actions");

    if (!exists) {
      await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          title: "LEON: Next actions",
          body: `Automatisk plan skapad.\n\nSe **LEON_PLAN.md** i repo.\n\nSenaste plan:\n\n${plan}`
        })
      });
    }

    return res.status(200).json({
      ok: true,
      wrote: path,
      commit: putData?.commit?.sha || null,
      issueCreated: !exists
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
