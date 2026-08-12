import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// A separate, edge-safe NextAuth instance built only from the Prisma-free
// config — no Credentials provider here, since bcrypt/Prisma can't run on
// the Edge runtime. This only needs to decode the JWT cookie and run the
// `authorized` callback (see auth.config.ts), which is enough to gate
// routes before any page code executes — defense in depth alongside the
// per-action/per-page requireSession() checks, not a replacement for them.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/operations/:path*", "/intelligence/:path*"],
};
