import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaKeepAliveInterval: NodeJS.Timeout | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Neon's serverless compute auto-suspends after ~5 minutes idle — the first
// query after that makes the whole page wait for it to wake back up, which
// is what "switching pages feels slow" turned out to be locally (measured:
// a query-heavy page went from ~29s cold to <1s once warm). A lightweight
// periodic ping keeps the compute alive for as long as this Node process
// runs.
//
// Dev-only: this is meaningless (and wasted setup cost) on Vercel — a
// serverless function has no persistent event loop between invocations,
// so a setInterval started during one request never fires again once that
// invocation ends. Production cold-start latency there is handled instead
// by DATABASE_URL pointing at Neon's pooled endpoint (see .env.example).
if (!process.env.VERCEL && !globalForPrisma.prismaKeepAliveInterval) {
  const interval = setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => {
      // Best-effort — a missed ping just means the next real query pays
      // the wake-up cost once; not worth surfacing anywhere.
    });
  }, 4 * 60 * 1000);
  interval.unref();
  globalForPrisma.prismaKeepAliveInterval = interval;
}
