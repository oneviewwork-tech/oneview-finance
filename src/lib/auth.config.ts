import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

// Edge-safe base config — no Prisma import here. proxy.ts runs on the
// Edge runtime and can only use this file; the Credentials provider (which
// needs Prisma + bcrypt, both Node-only) is layered on top of this in
// auth.ts for Node-runtime usage (route handler, server components/actions).
export const authConfig: NextAuthConfig = {
  // Vercel terminates TLS and sets X-Forwarded-Host/Proto itself, so its
  // host headers are trustworthy — without this, Auth.js rejects requests
  // on preview deployment URLs (which don't match a fixed AUTH_URL) with
  // an UntrustedHost error.
  trustHost: true,
  session: {
    strategy: "jwt",
    // Financial data — a much shorter idle window than a typical consumer
    // app's 30-day default. maxAge is the hard ceiling; updateAge rolls
    // the expiry forward on activity so a user working continuously never
    // gets logged out mid-task.
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 30 * 60, // 30 minutes
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // No `authorized` callback here on purpose. It is only consulted when
    // NextAuth's middleware runs bare (`export default auth`); proxy.ts has
    // to supply a handler in order to mint a per-request CSP nonce, and a
    // handler's return value supersedes `authorized`. Defining it here too
    // would be dead code that reads like it's enforcing something. Route
    // gating lives in proxy.ts; per-page/action enforcement lives in
    // requireUser()/requireSession().
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.sub!;
      session.user.role = token.role as UserRole;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      session.user.sessionId = token.sessionId as string | undefined;
      return session;
    },
  },
};
