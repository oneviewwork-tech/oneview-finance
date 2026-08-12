import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Applied to every route.
//
// Content-Security-Policy is deliberately NOT here — it lives in src/proxy.ts
// because it needs a fresh per-request nonce. A static `script-src 'self'`
// blocks the inline <script> tags Next uses to stream the App Router payload,
// which leaves every page stuck on its loading skeleton in production while
// looking perfectly fine in dev. See the comment in proxy.ts.
//
// HSTS stays production-only: it has no business being sent over the
// plain-HTTP localhost dev server.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
