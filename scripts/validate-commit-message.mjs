import { readFileSync } from "node:fs";

const messageFile = process.argv[2];
if (!messageFile) throw new Error("Pass the commit message file path.");

const subject = readFileSync(messageFile, "utf8").split("\n")[0];
const conventionalCommit = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._/-]+\))?!?: .+$/;

if (!conventionalCommit.test(subject)) {
  throw new Error(
    `Use a conventional commit subject, for example: fix: correct recurring chore scheduling. Received: ${subject}`
  );
}
