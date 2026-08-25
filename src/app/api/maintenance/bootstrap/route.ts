import { NextResponse } from "next/server";
import { runCatalogueBootstrap, type BootstrapOptions } from "@/lib/maintenance/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET_NOT_SET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const options = await request.json().catch(() => ({})) as BootstrapOptions;
    return NextResponse.json({ ok: true, ...(await runCatalogueBootstrap(options)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("catalogue bootstrap failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
