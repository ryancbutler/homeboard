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

const attemptWindow = "15 minutes";
const lockDuration = "5 minutes";
const maxAttempts = 5;

async function isPinLocked(householdId: string) {
  const [attempt] = await db<{ locked_until: Date | null }[]>`
    SELECT locked_until FROM household_pin_attempts WHERE household_id = ${householdId}`;
  return Boolean(attempt?.locked_until && attempt.locked_until > new Date());
}

async function recordFailedPinAttempt(householdId: string) {
  const [attempt] = await db<{ locked_until: Date | null }[]>`
    INSERT INTO household_pin_attempts (household_id, failed_attempts, last_failed_at, locked_until)
    VALUES (${householdId}, 1, now(), NULL)
    ON CONFLICT (household_id) DO UPDATE SET
      failed_attempts = CASE
        WHEN household_pin_attempts.last_failed_at < now() - ${attemptWindow}::interval THEN 1
        ELSE household_pin_attempts.failed_attempts + 1
      END,
      last_failed_at = now(),
      locked_until = CASE
        WHEN (CASE
          WHEN household_pin_attempts.last_failed_at < now() - ${attemptWindow}::interval THEN 1
          ELSE household_pin_attempts.failed_attempts + 1
        END) >= ${maxAttempts} THEN now() + ${lockDuration}::interval
        ELSE NULL
      END,
      updated_at = now()
    RETURNING locked_until`;
  return Boolean(attempt?.locked_until && attempt.locked_until > new Date());
}

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

    if (await isPinLocked(householdId)) {
      return NextResponse.json({ error: "Too many PIN attempts. Try again in a few minutes." }, { status: 429 });
    }

    const isValid = await verifyHouseholdPin(householdId, input.pin);
    if (!isValid) {
      if (await recordFailedPinAttempt(householdId)) {
        return NextResponse.json({ error: "Too many PIN attempts. Try again in a few minutes." }, { status: 429 });
      }
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    await db`DELETE FROM household_pin_attempts WHERE household_id = ${householdId}`;

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
