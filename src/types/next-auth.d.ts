import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      mustChangePassword: boolean;
      sessionId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    mustChangePassword: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    mustChangePassword: boolean;
    sessionId?: string;
  }
}
