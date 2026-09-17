import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subheading: z.string().trim().min(1).max(200).optional(),
  showBanner: z.boolean().optional(),
});

export async function GET() {
  try {
    const context = await requireContext();
    const rows = await db<{
      id: string;
      name: string;
      subheading: string;
      show_banner: boolean;
      timezone: string;
    }[]>`
      SELECT id, name, subheading, show_banner, timezone
      FROM households WHERE id = ${context.householdId}`;

    if (!rows[0]) throw new Error("Household not found");

    return NextResponse.json({
      id: rows[0].id,
      name: rows[0].name,
      subheading: rows[0].subheading,
      showBanner: rows[0].show_banner,
      timezone: rows[0].timezone,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireContext(true);
    const input = updateSchema.parse(await request.json());

    const updates: { name?: string; subheading?: string; show_banner?: boolean } = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.subheading !== undefined) updates.subheading = input.subheading;
    if (input.showBanner !== undefined) updates.show_banner = input.showBanner;

    if (Object.keys(updates).length > 0) {
      await db`
        UPDATE households
        SET ${db(updates)}
        WHERE id = ${context.householdId}`;
    }

    const [updated] = await db<{
      id: string;
      name: string;
      subheading: string;
      show_banner: boolean;
      timezone: string;
    }[]>`
      SELECT id, name, subheading, show_banner, timezone
      FROM households WHERE id = ${context.householdId}`;

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      subheading: updated.subheading,
      showBanner: updated.show_banner,
      timezone: updated.timezone,
    });
  } catch (error) {
    return apiError(error);
  }
}
