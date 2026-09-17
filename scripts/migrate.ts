import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1 });
await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const applied = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((row) => row.name));
const directory = join(process.cwd(), "db", "migrations");
for (const filename of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
  if (applied.has(filename)) continue;
  const migration = await readFile(join(directory, filename), "utf8");
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
    await transaction`INSERT INTO schema_migrations (name) VALUES (${filename})`;
  });
  console.info(`Applied ${filename}`);
}
await sql.end();
