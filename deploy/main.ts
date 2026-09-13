// Public HTML front for Whumpf's server-rendered pages.
//
// Why this exists: Supabase deliberately rewrites `text/html` to
// `text/plain` (plus a sandbox CSP) on `*.supabase.co` edge-function
// domains as an anti-phishing measure, so the SAR packet page and the
// legal pages rendered as raw source in a browser. Serving HTML from
// Supabase needs the Pro plan's Custom Domain add-on. This is the free
// alternative: a thin proxy on Deno Deploy that forwards to the existing
// functions and re-serves the response as real HTML.
//
// Deliberately a proxy, not a port: all the logic, auth and database
// access stay in the Supabase functions, so there's one implementation
// to maintain and no service-role key lives here.
//
//   /p?t=<token>   → trip-plan-page   (the packet a contact opens)
//   /privacy       → legal/privacy
//   /support       → legal/support
//   /              → redirects to /privacy
//
// POSTs are forwarded too, so the packet page's contact actions (extend,
// heard from, started a search) keep working; same-origin, so the page's
// own `form-action 'self'` CSP is satisfied.

const SUPABASE = Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  "https://avycomparison.supabase.co/functions/v1";

const ROUTES: Record<string, string> = {
  "/p": "/trip-plan-page",
  "/privacy": "/legal/privacy",
  "/support": "/legal/support",
};

// Headers we set ourselves rather than pass through — either because
// Supabase rewrote them (content-type, CSP) or because they'd be wrong
// on this origin (content-length after any re-encode).
const DROP = new Set([
  "content-type",
  "content-security-policy",
  "content-length",
  "content-encoding",
  "transfer-encoding",
]);

function securityHeaders(isPacket: boolean): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": isPacket ? "no-store" : "public, max-age=900",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // The packet page must not be indexed: the token is the only thing
    // protecting someone's medical notes and home address.
    ...(isPacket ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'",
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/" ) {
    return Response.redirect(new URL("/privacy", url.origin), 302);
  }
  if (path === "/healthz") {
    return new Response("ok", { headers: { "Content-Type": "text/plain" } });
  }

  const target = ROUTES[path];
  if (!target) return new Response("Not found", { status: 404 });

  const upstream = new URL(SUPABASE + target);
  // Carry the query string through (the packet's ?t=<token>, ?m=<flash>).
  for (const [k, v] of url.searchParams) upstream.searchParams.set(k, v);

  const init: RequestInit = {
    method: req.method,
    headers: {
      // The functions are deployed --no-verify-jwt, so no auth is needed;
      // pass the content type so form posts arrive as forms.
      ...(req.headers.get("content-type")
        ? { "Content-Type": req.headers.get("content-type")! }
        : {}),
    },
    redirect: "manual",
    ...(req.method === "POST" ? { body: await req.text() } : {}),
  };

  const res = await fetch(upstream, init);

  // A 303 from the packet page's form handler points back at the Supabase
  // host; rewrite it to this origin so the user stays on the pretty URL.
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      const to = new URL(loc);
      const back = new URL(url.origin + path);
      for (const [k, v] of to.searchParams) back.searchParams.set(k, v);
      return Response.redirect(back.toString(), 303);
    }
  }

  const body = await res.text();
  const headers = new Headers(securityHeaders(path === "/p"));
  for (const [k, v] of res.headers) {
    if (!DROP.has(k.toLowerCase()) && !headers.has(k)) headers.set(k, v);
  }
  return new Response(body, { status: res.status, headers });
});
