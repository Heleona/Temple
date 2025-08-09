// /api/health — minimal status
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasGitHub: !!process.env.GITHUB_TOKEN && !!process.env.REPO_OWNER && !!process.env.REPO_NAME,
    ts: new Date().toISOString()
  });
}
