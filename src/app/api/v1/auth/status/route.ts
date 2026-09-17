import { NextResponse } from "next/server";
import { contextFromCookies, getPrimaryParent } from "@/lib/auth";

export async function GET() {
  const context = await contextFromCookies();
  if (context?.role === "parent") {
    const parent = await getPrimaryParent(context.householdId);
    return NextResponse.json({
      authenticated: true,
      role: "parent",
      parentName: parent?.display_name ?? "Parent"
    });
  }
  return NextResponse.json({
    authenticated: false,
    role: context?.role ?? "guest"
  });
}
