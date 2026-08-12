import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

// Edge-safe base config — no Prisma import here. middleware.ts runs on the
// Edge runtime and can only use this file; the Credentials provider (which
// needs Prisma + bcrypt, both Node-only) is layered on top of this in
// auth.ts for Node-runtime usage (route handler, server components/actions).
export const authConfig: NextAuthConfig = {
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
    authorized: ({ auth: session, request }) => {
      const isLoggedIn = !!session?.user;
      const path = request.nextUrl.pathname;
      const isAuthRoute = path === "/login";
      // Everything under /operations and /intelligence requires a session;
      // this callback is what middleware.ts actually enforces (see there).
      if (isAuthRoute) return true;
      if (!isLoggedIn) return false;
      // A forced password change blocks every protected route until it's
      // done — centralized here so no individual page can forget the check.
      if (session.user.mustChangePassword && path !== "/change-password") {
        return NextResponse.redirect(new URL("/change-password", request.nextUrl));
      }
      return true;
    },
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
