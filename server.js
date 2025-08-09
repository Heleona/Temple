// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1) Serve index.html på /
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2) Enkla API:er så sidan har något att pinga
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString()
  });
});

app.get('/api/tick', (_req, res) => {
  res.json({ now: Date.now() });
});

// 3) (frivilligt just nu) enkel chat-stub så inget kraschar
app.post('/api/chat', (req, res) => {
  const msg = (req.body && req.body.message) || '';
  res.json({ reply: `Leon: Jag hör dig. Du skrev: "${msg}"` });
});

app.listen(PORT, () => {
  console.log(`Leon server live on :${PORT}`);
});
