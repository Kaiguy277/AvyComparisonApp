// App Store Connect browser harness (used 2026-10-06 to submit 1.0 — see LOG).
//
// Setup (once, outside the repo's package.json):
//   mkdir -p /tmp/asc && cd /tmp/asc && npm init -y && npm i playwright && npx playwright install chromium
//   cp <repo>/scripts/asc-browser/server.mjs . && node server.mjs
// Then drive it with curl from a Claude session:
//   curl -s -X POST 127.0.0.1:9777/eval --data 'await page.goto("https://appstoreconnect.apple.com"); return page.url();'
//   curl -s -X POST 127.0.0.1:9777/text          # visible page text + url + title
//   curl -s -X POST 127.0.0.1:9777/shot --data x # screenshot into ./shots
//   curl -s -X POST 127.0.0.1:9777/quit
// Kai types the Apple password + 2FA in the window once; the profile dir keeps the
// session for the run. ASC's sign-in form is in an iframe on idmsa.apple.com.
// Gotchas learned: the build-row Delete control only appears on hover; "Add Build"
// radio ids are delivery UUIDs (select with input[id="…"], not #…); the review
// Attachment input is the input[type=file] nearest the "Attachment" label and
// uploads itself without Save.
/* eslint-disable import/no-unresolved -- playwright is installed next to this file, not in the repo */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PROFILE = path.join(ROOT, "profile");
const SHOTS = path.join(ROOT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
});
let page = context.pages()[0] ?? (await context.newPage());
context.on("page", (p) => { page = p; });

let shotN = 0;
async function shot(name = "") {
  shotN++;
  const file = path.join(SHOTS, `${String(shotN).padStart(3, "0")}${name ? "-" + name : ""}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.url === "/eval") {
      // body is an async function body with `page`, `context`, `shot` in scope
      const fn = new Function("page", "context", "shot", `return (async () => { ${body} })();`);
      const result = await fn(page, context, shot);
      reply(200, { ok: true, result });
    } else if (req.url === "/shot") {
      reply(200, { ok: true, file: await shot(body.trim()) });
    } else if (req.url === "/text") {
      // visible text of the page, trimmed, for reading without a screenshot
      const text = await page.evaluate(() => document.body.innerText);
      reply(200, { ok: true, url: page.url(), title: await page.title(), text: text.slice(0, 20000) });
    } else if (req.url === "/quit") {
      reply(200, { ok: true });
      await context.close();
      server.close();
      process.exit(0);
    } else {
      reply(404, { ok: false, error: "unknown route" });
    }
  } catch (err) {
    reply(500, { ok: false, error: String(err && err.stack ? err.stack : err) });
  }
});

server.listen(9777, "127.0.0.1", () => {
  console.log("pw-server listening on http://127.0.0.1:9777");
});
