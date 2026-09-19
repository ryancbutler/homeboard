import { NextResponse } from "next/server";
import packageInfo from "../../../../../package.json";
import { requireContext } from "@/lib/auth";
import { databaseDialect, db } from "@/lib/db";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

const databaseUrl = process.env.DATABASE_URL ?? "";

function databaseConfiguration() {
  if (databaseDialect === "sqlite") {
    const path = databaseUrl.replace(/^(file:|libsql:)/, "") || "configured local database";
    return { dialect: "SQLite", location: path, poolSize: null };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      dialect: "PostgreSQL",
      location: `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`,
      poolSize: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    };
  } catch {
    return {
      dialect: "PostgreSQL",
      location: "configured database",
      poolSize: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    };
  }
}

export async function GET() {
  try {
    const context = await requireContext(true);
    const [counts] = await db<
      [
        {
          chore_templates: number;
          active_chore_templates: number;
          chore_occurrences: number;
          completed_chores: number;
          routine_templates: number;
          children: number;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*) FROM chore_templates WHERE household_id = ${context.householdId})::integer AS chore_templates,
        (SELECT COUNT(*) FROM chore_templates WHERE household_id = ${context.householdId} AND active = true)::integer AS active_chore_templates,
        (SELECT COUNT(*) FROM chore_occurrences WHERE household_id = ${context.householdId})::integer AS chore_occurrences,
        (SELECT COUNT(*) FROM chore_obligations o JOIN chore_occurrences co ON co.id = o.occurrence_id WHERE co.household_id = ${context.householdId} AND o.status = 'completed')::integer AS completed_chores,
        (SELECT COUNT(*) FROM routine_templates WHERE household_id = ${context.householdId})::integer AS routine_templates,
        (SELECT COUNT(*) FROM members WHERE household_id = ${context.householdId} AND role = 'child' AND active = true)::integer AS children`;

    const [size] =
      databaseDialect === "postgres"
        ? await db<[{ bytes: number }]>`SELECT pg_database_size(current_database())::bigint AS bytes`
        : await db<
            [{ bytes: number }]
          >`SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()`;

    return NextResponse.json(
      {
        version: packageInfo.version,
        database: { ...databaseConfiguration(), bytes: Number(size?.bytes ?? 0) },
        chores: {
          templates: Number(counts?.chore_templates ?? 0),
          activeTemplates: Number(counts?.active_chore_templates ?? 0),
          managedOccurrences: Number(counts?.chore_occurrences ?? 0),
          completed: Number(counts?.completed_chores ?? 0),
        },
        routines: Number(counts?.routine_templates ?? 0),
        children: Number(counts?.children ?? 0),
      },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    return apiError(error);
  }
}
