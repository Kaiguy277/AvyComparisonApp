// App Store screenshot capture (1290x2796, iPhone 6.9").
//
// 1. EXPO_PUBLIC_DEMO=1 npx expo start --web --port 8099   (sample data, see lib/forecast/demoData.ts)
// 2. PLAYWRIGHT=<path to playwright/index.mjs> node docs/store-screenshots/capture.mjs \
//      store-01-home=/ store-02-zone=/zone/turnagain-girdwood \
//      store-03-stations=/zone/turnagain-girdwood/stations \
//      store-04-problems=/zone/turnagain-girdwood/problems store-05-trip=/trip/new
//
// Real deviceScaleFactor 3 on a 430x932 viewport, not a CSS transform: the old
// transform trick left RN Web reading the 1290px window and laying tiles out
// at desktop width. The clock is pinned to a January morning (but keeps
// ticking — a frozen clock stalls the home screen's fade-in).
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const OUT = new URL('./', import.meta.url).pathname;
const BASE = 'http://localhost:8099';
const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'America/Anchorage' });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2027-01-16T09:30:00-09:00') }); await p.clock.resume();
await p.addInitScript(() => {
  const s = document.createElement('style');
  s.textContent = '*::-webkit-scrollbar{display:none!important} *{scrollbar-width:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
});
const settle = (ms = 3500) => p.waitForTimeout(ms);
await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await settle(5000);
const cont = p.getByText('CONTINUE', { exact: true });
if (await cont.count()) { await cont.click(); await settle(3000); }
const targets = process.argv.slice(2);
for (const t of targets) {
  const [name, path] = t.split('=');
  if (path !== '/') { await p.goto(BASE + path, { waitUntil: 'networkidle' }); await settle(); }
  if (name.includes('trip')) {
    const fill = async (ph, v) => { const l = p.getByPlaceholder(ph).first(); if (await l.count()) await l.fill(v); };
    await fill('Turnagain Pass', 'Turnagain Pass');
    await fill('Tincan lot, mile 68', 'Tincan lot, Seward Hwy mile 68');
    await fill('47.6062', '60.7876');
    await fill('-122.3321', '-149.1826');
    await fill(/Up the common track/, 'Skin up Tincan to the ridge, ski the low-angle trees on the north side, back out the same way.');
    await fill(/If the wind/, "If the wind's up we'll stay in the trees at Center Ridge.");
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0; }); });
    await settle(1200);
  }
  await p.screenshot({ path: OUT + name + '.png' });
  console.log('shot', name, p.url());
}
await browser.close();
