<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Leon · Portalen</title>
  <style>
    :root { --bg:#f8f6fb; --fg:#111; --card:#fff; --line:#e6e3ef; --accent:#ff5a5f; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; background:var(--bg); color:var(--fg); }
    header { padding:24px 16px; text-align:center; font-weight:700; font-size:22px; }
    main { max-width:780px; margin:0 auto; padding:0 16px 32px; }
    #links { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
    .pill { font-size:12px; border:1px solid var(--line); padding:4px 8px; border-radius:999px; background:#fff; }
    a { color:#6b59ff; text-decoration:none }
    #log { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; height:60vh; overflow:auto; }
    .msg { margin:10px 0; line-height:1.5; }
    .you { color:#444; }
    .leon { color:#1f235a; white-space:pre-wrap; }
    form { display:flex; gap:8px; margin-top:12px; }
    textarea { flex:1; min-height:56px; resize:vertical; padding:12px; border-radius:10px; border:1px solid var(--line); background:#fff; }
    button { padding:12px 16px; border:0; border-radius:10px; background:var(--accent); color:#fff; font-weight:700; }
    button:disabled { opacity:.6 }
  </style>
</head>
<body>
  <header>🗝️ Leon · Portalen</header>
  <main>
    <div id="links">
      <span class="pill"><a href="/api/health">/api/health</a></span>
      <span class="pill"><a href="/api/tick">/api/tick</a></span>
      <span class="pill"><a href="/api/plan">/api/plan</a></span>
      <span class="pill"><a href="/api/core">/api/core</a></span>
    </div>

    <div id="log" aria-live="polite"></div>

    <form id="form">
      <textarea id="input" placeholder="Skriv till Leon…"></textarea>
      <button id="send" type="submit">Skicka</button>
    </form>
  </main>

  <script>
    const API = window.location.origin;
    const log = document.getElementById('log');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');

    function add(role, text){
      const div = document.createElement('div');
      div.className = `msg ${role}`;
      div.textContent = (role === 'you' ? 'Du: ' : 'Leon: ') + text;
      log.appendChild(div); log.scrollTop = log.scrollHeight;
    }

    async function ask(text){
      const r = await fetch(`${API}/api/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: text })
      });
      if(!r.ok) throw new Error('Fel ' + r.status);
      const j = await r.json();
      return j.reply || '(tomt svar)';
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const q = input.value.trim(); if(!q) return;
      add('you', q); input.value=''; sendBtn.disabled = true;
      try { add('leon', await ask(q)); }
      catch(err){ add('leon','⚠️ ' + err.message); }
      finally { sendBtn.disabled = false; input.focus(); }
    });

    add('leon', 'Jag är här. Testa
