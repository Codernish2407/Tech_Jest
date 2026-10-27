import { NextResponse } from "next/server";
import { getServiceCatalog } from "@/backend/supabase/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const catalog = await getServiceCatalog();
  return NextResponse.json(
    catalog.status === "ready"
      ? catalog.services
      : { error: "The service catalog is temporarily unavailable. Please try again." },
    {
      status: catalog.status === "ready" ? 200 : 503,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}
