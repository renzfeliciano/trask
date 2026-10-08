import { NextResponse } from "next/server";
import { checkHealth } from "@/server/health/service";

// Probed live on every call; a cached answer would defeat the point.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const status = await checkHealth();
  return NextResponse.json(
    { status },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
