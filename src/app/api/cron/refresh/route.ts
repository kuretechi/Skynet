import { NextResponse } from "next/server";
import { runCatalogueRefresh } from "@/lib/maintenance/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled upkeep endpoint (see `crons` in vercel.json). Also safe to call by
 * hand with the same bearer token when running the app somewhere else.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET_NOT_SET" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runCatalogueRefresh()) });
  } catch (error) {
    console.error("catalogue refresh failed", error);
    return NextResponse.json({ error: "REFRESH_FAILED" }, { status: 500 });
  }
}
