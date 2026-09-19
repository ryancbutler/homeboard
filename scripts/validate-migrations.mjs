import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const migrationName = /^(\d{3})_[a-z0-9_]+\.sql$/;
const postgresMigrations = readdirSync("db/migrations", { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

if (postgresMigrations.length === 0) throw new Error("At least one PostgreSQL migration is required.");

for (const [index, filename] of postgresMigrations.entries()) {
  const match = filename.match(migrationName);
  if (!match) throw new Error(`Migration filenames must use NNN_descriptive_name.sql: ${filename}`);
  const expectedNumber = String(index + 1).padStart(3, "0");
  if (match[1] !== expectedNumber) throw new Error(`Expected migration ${expectedNumber}, found ${filename}.`);
}

const sqliteSnapshot = "db/migrations/sqlite/001_initial.sql";
const snapshot = readFileSync(sqliteSnapshot, "utf8");
const alignedThrough = snapshot.match(/^-- PostgreSQL migration baseline: (\d{3})$/m)?.[1];
const latestMigration = postgresMigrations.at(-1).slice(0, 3);
if (alignedThrough !== latestMigration) {
  throw new Error(`${sqliteSnapshot} must declare -- PostgreSQL migration baseline: ${latestMigration}.`);
}

if (process.argv.includes("--staged")) {
  const addedPostgresMigration = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=A", "--", "db/migrations"],
    { encoding: "utf8" }
  )
    .split("\n")
    .some((file) => file.startsWith("db/migrations/") && !file.startsWith("db/migrations/sqlite/"));
  const stagedSnapshot =
    execFileSync("git", ["diff", "--cached", "--name-only", "--", sqliteSnapshot], { encoding: "utf8" }).trim().length >
    0;

  if (addedPostgresMigration && !stagedSnapshot) {
    throw new Error(`A new PostgreSQL migration requires an updated ${sqliteSnapshot} schema snapshot.`);
  }
}
