// /api/tick – triggar /api/plan och returnerar status
export default async function handler(req, res) {
  const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  try {
    const r = await fetch(`${base}/api/plan?run=1`, { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    res.status(200).json({
      ok: true,
      triggered: '/api/plan',
      result: data,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
