import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Deliberately unauthenticated and cheap — a scheduler pings this to keep
// Neon's compute from auto-suspending, and it doubles as a liveness probe.
// Returns no data beyond "the DB answered" — nothing here is sensitive.
//
// Note the current pinger (.github/workflows/keep-warm.yml) is throttled by
// GitHub well below the interval needed to actually prevent the ~5-minute
// suspend; see that file. This endpoint is correct either way — point a
// scheduler that honours its interval at it and the keep-warm works.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
