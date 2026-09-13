# Whumpf public pages (Deno Deploy)

A thin proxy that serves the Supabase-rendered pages as real HTML.

**Why:** Supabase rewrites `text/html` → `text/plain` with a sandbox CSP on
`*.supabase.co` function domains (anti-phishing). Every SAR packet link and both
legal pages rendered as raw source in a browser. Serving HTML from Supabase
requires the Pro plan's Custom Domain add-on; this is the free path.

**What it is not:** a port. All logic, auth and database access stay in the
Supabase edge functions. No service-role key lives here, and there's only one
implementation of the page to maintain.

## Routes

| path | upstream |
|---|---|
| `/p?t=<token>` | `trip-plan-page` — the packet a contact opens |
| `/privacy` | `legal/privacy` |
| `/support` | `legal/support` |
| `/healthz` | liveness |

POSTs are forwarded so the packet's contact actions (extend, heard from, search
started) keep working, and the 303 they return is rewritten back to this origin.

## Env

- `SUPABASE_FUNCTIONS_URL` — defaults to
  `https://avycomparison.supabase.co/functions/v1`.

## Live

- **Origin:** `https://whumpf-pages.kaimyersa.deno.net` (Deno Deploy, org `kaimyersa`,
  app `whumpf-pages`, Google login on the account).
- Packet base secret is set: `TRIP_PLAN_PAGE_BASE=https://whumpf-pages.kaimyersa.deno.net/p`.
- App Store privacy/support URLs should point at `/privacy` and `/support` on this host
  (pending — do it next time ASC is open).

## Deploying an update

The `deno deploy` **wrapper double-forwards every flag** ("Option --x can only occur
once"), so deploy by invoking the tool directly, which gets clean args:

```
export DENO_DEPLOY_TOKEN=<org token from console.deno.com › Settings › Organization Tokens>
cd deploy
deno run -A --node-modules-dir=auto jsr:@deno/deploy --org kaimyersa --app whumpf-pages --prod main.ts
```

(For the very first create it was `... jsr:@deno/deploy create --non-interactive --org
kaimyersa --app whumpf-pages --source local --runtime-mode dynamic --entrypoint main.ts
--region us`.)

Old share links on the Supabase host still resolve (they render as source), so nothing
already sent breaks further — but everything new points at the Deno origin.
