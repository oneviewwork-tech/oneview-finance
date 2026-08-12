import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/client-ip";

// Account-based brute-force lockout (independent of, and complementary to,
// any IP-based limiting at the platform/proxy level — see security-headers
// notes in next.config.ts). 5 wrong passwords locks the account for 15
// minutes; the counter resets on any successful login.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

async function createLoginSession(user: { id: string; ipAddress?: string | null; userAgent?: string | null }) {
  const session = await prisma.userSession.create({
    data: { userId: user.id, ipAddress: user.ipAddress ?? null, userAgent: user.userAgent ?? null },
  });
  return session.id;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials, request) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        const ipAddress = getClientIp(request.headers);
        const userAgent = request.headers.get("user-agent");

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Same rejection path (and cost) whether the account doesn't exist,
        // is deactivated, or is locked — the login form never reveals which,
        // so an attacker can't use it to enumerate valid usernames.
        if (!user || !user.isActive) {
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: email,
            action: "LOGIN_FAILED",
            actorUserId: null,
            actorEmail: email,
            metadata: { reason: user ? "inactive" : "not_found", ipAddress, userAgent },
          });
          // Real bcrypt.compare cost even on a miss, so response timing
          // doesn't leak "this email doesn't exist" vs "wrong password."
          await bcrypt.compare(password, "$2a$10$invalidsaltinvalidsaltinvalidsaltinva");
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: user.id,
            action: "LOGIN_FAILED",
            actorUserId: user.id,
            actorEmail: user.email,
            metadata: { reason: "locked", lockedUntil: user.lockedUntil.toISOString(), ipAddress, userAgent },
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockingNow = attempts >= LOCKOUT_THRESHOLD;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_DURATION_MS) : user.lockedUntil,
            },
          });
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: user.id,
            action: lockingNow ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            actorUserId: user.id,
            actorEmail: user.email,
            metadata: { reason: "wrong_password", attempts, ipAddress, userAgent },
          });
          return null;
        }

        // Success — reset the lockout counter.
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          ipAddress,
          userAgent,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async (params) => {
      const token = await authConfig.callbacks!.jwt!(params);
      const { user } = params;
      if (user) {
        const sessionId = await createLoginSession({ id: user.id!, ipAddress: user.ipAddress, userAgent: user.userAgent });
        await writeAuditEvent(prisma, {
          entityType: "User",
          entityId: user.id!,
          action: "LOGIN",
          actorUserId: user.id!,
          actorEmail: user.email!,
          metadata: { sessionId, ipAddress: user.ipAddress, userAgent: user.userAgent },
        });
        if (!token) return token;
        token.sessionId = sessionId;
      }
      return token;
    },
  },
  events: {
    signOut: async (message) => {
      const token = "token" in message ? (message.token as JWT | null) : null;
      if (!token?.sessionId) return;
      try {
        await prisma.userSession.update({ where: { id: token.sessionId }, data: { logoutAt: new Date() } });
        await writeAuditEvent(prisma, {
          entityType: "User",
          entityId: token.sub ?? token.sessionId,
          action: "LOGOUT",
          actorUserId: token.sub ?? null,
          actorEmail: null,
          metadata: { sessionId: token.sessionId },
        });
      } catch (err) {
        console.error("signOut event failed", err);
      }
    },
  },
});
