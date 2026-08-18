import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { requiresPasskey, isPasskeyRoute, isApiPath } from "@/domain/auth/passkey-policy";
import { PASSKEY_COOKIE, isStepUpValidFor } from "@/lib/passkey-token";

// A separate, edge-safe NextAuth instance built only from the Prisma-free
// config — no Credentials provider here, since bcrypt/Prisma can't run on
// the Edge runtime. This only needs to decode the JWT cookie and run the
// `authorized` callback (see auth.config.ts), which is enough to gate
// routes before any page code executes — defense in depth alongside the
// per-action/per-page requireSession() checks, not a replacement for them.
const { auth } = NextAuth(authConfig);

/**
 * CSP must be built per-request, not set statically in next.config.ts.
 *
 * Next.js streams the App Router payload as inline <script> tags. A static
 * `script-src 'self'` therefore blocks Next's own hydration scripts, the RSC
 * payload never applies, and every page renders its loading skeleton forever
 * — correct HTML from the server, permanently unhydrated in the browser.
 *
 * The fix is a per-request nonce: Next reads it from the Content-Security-
 * Policy request header and stamps it onto the scripts it emits, so they're
 * allowed while genuinely injected inline scripts still aren't. 'strict-
 * dynamic' lets those nonce'd bootstrap scripts load the chunks they need
 * without having to allowlist every chunk URL.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind and React inline style attributes need this; there is no
    // nonce mechanism for style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Deliberately no `upgrade-insecure-requests`: HSTS (next.config.ts)
    // already forces HTTPS on the real domain, and this directive breaks
    // running the production build locally over plain HTTP, which is
    // exactly how this CSP's effect on hydration has to be verified.
  ].join("; ");
}

/**
 * Route gating lives here, not in authConfig's `authorized` callback.
 *
 * `authorized` only decides the outcome when NextAuth's middleware is used
 * bare (`export default auth`). Once a handler is supplied — which it must
 * be here, to mint the per-request CSP nonce — the handler's return value is
 * what ships, so an unconditional NextResponse.next() silently discards
 * `authorized`'s redirect and lets unauthenticated requests through to the
 * page. Keeping both would mean two sources of truth for the same decision;
 * this is the one that actually runs.
 *
 * Pages still call requireUser()/requireSession() independently — that is
 * the real security boundary. This is the redirect layer that turns "not
 * signed in" into the login page instead of an error page.
 */
export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (!isLoggedIn) {
    // API callers get a status code, not a login page — now that
    // /api/export is matched, a redirect would hand a download HTML.
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    // /forgot-password has to be reachable by definition BEFORE signing in
    // — that's the whole flow it exists for.
    if (pathname !== "/login" && pathname !== "/forgot-password") {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  } else {
    // Signed in: keep them off the login page, and hold them on
    // /change-password until a forced reset is done.
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    if (req.auth?.user?.mustChangePassword && pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.nextUrl));
    }

    // Second factor. The password check has passed by this point; this is
    // the step-up gate for privileged roles and the Finance View surface.
    //
    // The proof is a signed cookie bound to this user AND this login
    // session, so it can't outlive the session or be replayed into another.
    // A missing AUTH_SECRET makes every proof unverifiable, which fails
    // closed here (isStepUpValidFor returns false) rather than open.
    const authSecret = process.env.AUTH_SECRET ?? "";
    const verified = await isStepUpValidFor(
      req.cookies.get(PASSKEY_COOKIE)?.value,
      authSecret,
      req.auth?.user?.id,
      req.auth?.user?.sessionId
    );

    if (requiresPasskey(req.auth?.user?.role, pathname, verified)) {
      // Exports and other API calls get a refusal, not a redirect: handing a
      // download an HTML login page would look like a corrupt file, and
      // silently serving the data would defeat the gate entirely.
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { error: "Passkey verification required" },
          { status: 403, headers: { "x-passkey-required": "1" } }
        );
      }
      const url = new URL("/passkey", req.nextUrl);
      url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }

    // Already cleared — don't make them look at the gate again.
    if (verified && isPasskeyRoute(pathname)) {
      const next = req.nextUrl.searchParams.get("next");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(new URL(safe, req.nextUrl));
    }
  }

  // Dev is left alone: Turbopack's HMR client needs 'unsafe-eval', and a
  // strict policy buys nothing on localhost.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Set on the *request* so Next can read the nonce and apply it to the
  // scripts it renders, and on the response so the browser enforces it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
});

export const config = {
  // "/" is the workspace chooser — it lists the signed-in user's workspaces,
  // so it's gated too; without it an unauthenticated visitor landed straight
  // on the chooser instead of the login page. /login and /change-password are
  // included so they get the CSP header as well (the `authorized` callback
  // lets them through).
  //
  // The bare "/operations" and "/intelligence" are listed separately from
  // their ":path*" forms: ":path*" does NOT match the parent segment on its
  // own, so without these an anonymous visitor hitting /intelligence skipped
  // the proxy entirely and got requireUser()'s error page instead of being
  // redirected to /login. (No data leaked either way — requireUser throws —
  // but the error page is the wrong answer to "you're not signed in".)
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/change-password",
    "/passkey",
    "/passkey/:path*",
    "/operations",
    "/operations/:path*",
    "/intelligence",
    "/intelligence/:path*",
    // Exports emit the same financial rows the dashboard renders, so the
    // second factor has to cover them too — otherwise the gate only slows
    // down the UI while the data stays one fetch away.
    "/api/export/:path*",
  ],
};
