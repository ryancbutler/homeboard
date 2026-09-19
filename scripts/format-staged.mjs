import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const formatExtensions = new Set([".css", ".js", ".json", ".mjs", ".ts", ".tsx", ".yaml", ".yml"]);
const stagedFiles = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" })
  .split("\n")
  .filter((file) => formatExtensions.has(file.slice(file.lastIndexOf("."))));

if (stagedFiles.length === 0) process.exit(0);

const prettier = "node_modules/prettier/bin/prettier.cjs";
if (!existsSync(prettier)) throw new Error("Prettier is not installed. Run npm ci.");

execFileSync(process.execPath, [prettier, "--write", ...stagedFiles], { stdio: "inherit" });
execFileSync("git", ["add", "--", ...stagedFiles], { stdio: "inherit" });
