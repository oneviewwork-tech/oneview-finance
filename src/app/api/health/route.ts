import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Deliberately unauthenticated and cheap — this exists purely so an
// external scheduler (see .github/workflows/keep-warm.yml) can ping it
// every few minutes to stop Neon's compute auto-suspending. Vercel's own
// Hobby-plan cron only runs once a day, too infrequent to prevent a
// 5-minute suspend, hence pinging from GitHub Actions instead. Returns no
// data beyond "the DB answered" — nothing here is sensitive.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
