import { NextResponse } from "next/server";
import { z } from "zod";
import { hashSecret, setSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const setupSchema = z.object({
  householdName: z.string().trim().min(1, "Enter a household name").max(100),
  parentName: z.string().trim().min(1, "Enter your name").max(100),
  pin: z.string().regex(/^\d{4,20}$/, "Use a PIN with 4 to 20 digits"),
});

export async function POST(request: Request) {
  try {
    const input = setupSchema.parse(await request.json());
    const pinHash = await hashSecret(input.pin);
    const result = await db.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('homeboard-initial-setup'))`;
      const [existing] = await sql<{ id: string }[]>`SELECT id FROM households ORDER BY created_at LIMIT 1`;
      if (existing) return null;

      const [household] = await sql<{ id: string; name: string }[]>`
        INSERT INTO households (name, fridge_pin_hash)
        VALUES (${input.householdName}, ${pinHash})
        RETURNING id, name`;
      const [parent] = await sql<{ id: string; display_name: string }[]>`
        INSERT INTO members (household_id, role, display_name)
        VALUES (${household.id}, 'parent', ${input.parentName})
        RETURNING id, display_name`;
      return { household, parent };
    });

    if (!result) {
      return NextResponse.json({ error: "A household is already configured. Refresh to continue." }, { status: 409 });
    }

    await setSession(result.parent.id);
    return NextResponse.json({ household: result.household, parent: result.parent }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
