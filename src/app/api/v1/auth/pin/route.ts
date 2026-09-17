import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSession, contextFromCookies, getPrimaryParent, requireContext, setSession, updateHouseholdPin, verifyHouseholdPin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { db } from "@/lib/db";

const pinSchema = z.object({
  pin: z.string().min(1).max(20)
});

const changePinSchema = z.object({
  newPin: z.string().min(4).max(20)
});

export async function POST(request: Request) {
  try {
    const input = pinSchema.parse(await request.json());
    const context = await contextFromCookies();
    let householdId = context?.householdId;

    if (!householdId) {
      const [h] = await db<{ id: string }[]>`SELECT id FROM households ORDER BY created_at LIMIT 1`;
      if (!h) throw new Error("Household not configured");
      householdId = h.id;
    }

    const isValid = await verifyHouseholdPin(householdId, input.pin);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    const parent = await getPrimaryParent(householdId);
    if (!parent) {
      return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
    }

    await setSession(parent.id);
    return NextResponse.json({ success: true, parent: { id: parent.id, displayName: parent.display_name } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = changePinSchema.parse(await request.json());
    const context = await requireContext(true);

    await updateHouseholdPin(context.householdId, input.newPin);
    return NextResponse.json({ success: true, message: "PIN updated successfully" });
  } catch (error) {
    return apiError(error);
  }
}
