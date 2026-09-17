import { NextResponse } from "next/server";
import { dashboardFor } from "@/lib/dashboard";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireContext();
    return NextResponse.json(await dashboardFor(context.householdId), {
      headers: { "Cache-Control": "no-store, must-revalidate" }
    });
  } catch (error) { return apiError(error); }
}
