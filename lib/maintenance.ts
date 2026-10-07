// The page everyone sees while MAINTENANCE_MODE is on (served by proxy.ts).
// Standalone HTML: the normal layout's sign-in gate calls the API, which is closed during maintenance.

export const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Back soon · 4th Grade Band Carpool</title>
<link rel="icon" href="/logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&family=Oswald:wght@600&family=Yellowtail&display=swap">
<style>
  :root { --ink: #000; --gold: #f5c542; --bg: #f6f5f1; --text: #1c1c1c; --muted: #5f5d57; color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font: 15px/1.55 "Montserrat", system-ui, sans-serif; color: var(--text); background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
  .bar { background: var(--ink); border-bottom: 5px solid var(--gold); padding: 12px 20px; display: flex; align-items: center; gap: 12px; color: #fff; }
  .bar small { display: block; color: var(--gold); font-size: .72rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
  .bar strong { display: block; font-size: 1.15rem; font-weight: 600; }
  .hero { background: var(--ink); color: #fff; padding: 44px 20px 56px; }
  .hero > div, main > div { max-width: 640px; margin: 0 auto; }
  .eyebrow { color: var(--gold); text-transform: uppercase; letter-spacing: .18em; font-weight: 700; font-size: .78rem; margin: 0; }
  h1 { font: 400 clamp(3rem, 12vw, 5rem)/1 "Yellowtail", "Brush Script MT", cursive; margin: 8px 0 0; }
  .brush { display: block; width: min(320px, 80%); height: 14px; margin: 4px 0 0; }
  main { flex: 1; padding: 0 20px 48px; }
  .card { background: #fff; border-top: 5px solid var(--gold); padding: 22px 24px; margin-top: -30px; box-shadow: 0 6px 18px rgba(0,0,0,.08); }
  .card h2 { font: 600 1.15rem "Oswald", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: .02em; margin: 0 0 8px; }
  .card p { margin: 0 0 10px; }
  .card p:last-child { margin: 0; color: var(--muted); }
</style>
</head>
<body>
  <header class="bar">
    <img src="/logo.svg" alt="" width="40" height="40">
    <div><small>Park View Elementary</small><strong>4th Grade Band Carpool</strong></div>
  </header>
  <section class="hero">
    <div>
      <p class="eyebrow">Down for maintenance</p>
      <h1>Back soon</h1>
      <svg class="brush" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9C80 2 220 2 318 7L316 12C220 8 90 9 4 13Z" fill="#f5c542"/></svg>
    </div>
  </section>
  <main>
    <div class="card">
      <h2>We&rsquo;re making some updates</h2>
      <p>The carpool site is briefly offline while we work on it. Your sign-ups and ride details are safe.</p>
      <p>Please check back a little later. If you need a ride sorted out before then, text the families or a coordinator directly.</p>
    </div>
  </main>
</body>
</html>`;
