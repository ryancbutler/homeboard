import { materializeChores, materializeRoutines, markMissed } from "@/lib/recurrence";

async function run() {
  await materializeChores();
  await materializeRoutines();
  await markMissed();
  console.info("Homeboard schedule materialized", new Date().toISOString());
}

await run();
if (process.env.WORKER_ONCE !== "true") setInterval(() => void run().catch(console.error), 5 * 60_000);
