import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Deliberately unauthenticated and cheap — UptimeRobot hits this every five
// minutes to keep Neon's compute from auto-suspending (~5-minute idle
// timeout, so the margin is thin by design rather than comfortable).
// Returns no data beyond "the DB answered" — nothing here is sensitive.
//
// The 503 below is load-bearing: the monitor treats any non-2xx as down, so
// this doubles as the outage alert for the database. Keep it a real status
// code — swallowing the error into a 200 would silence that.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
