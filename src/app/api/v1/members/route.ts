import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

const childSchema = z.object({ displayName: z.string().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), avatarUrl: z.string().url().optional().nullable() });

export async function GET() {
  try {
    const context = await requireContext(true);
    const members = await db<{ id: string; role: string; display_name: string; email: string | null; color: string; avatar_url: string | null; active: boolean }[]>`
      SELECT id, role, display_name, email, color, avatar_url, active FROM members WHERE household_id = ${context.householdId} ORDER BY role, display_name`;
    return NextResponse.json(members.map((member) => ({ id: member.id, role: member.role, displayName: member.display_name, email: member.email, color: member.color, avatarUrl: member.avatar_url, active: member.active })));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const child = childSchema.parse(await request.json());
    const rows = await db<{ id: string }[]>`
      INSERT INTO members (household_id, role, display_name, color, avatar_url) VALUES (${context.householdId}, 'child', ${child.displayName}, ${child.color}, ${child.avatarUrl ?? null}) RETURNING id`;
    await db`INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id) VALUES (${context.householdId}, ${context.memberId!}, 'child.created', 'member', ${rows[0].id})`;
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
