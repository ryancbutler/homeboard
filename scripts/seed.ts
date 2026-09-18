import { hash } from "@node-rs/argon2";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url);
const existing = await sql<{ id: string }[]>`SELECT id FROM households LIMIT 1`;
if (existing[0]) { console.info("A household already exists; seed skipped."); await sql.end(); process.exit(0); }

const initialPin = process.env.PARENT_PIN || process.env.INITIAL_PIN;
if (!initialPin) throw new Error("PARENT_PIN or INITIAL_PIN is required when seeding a household");
const pin = await hash(initialPin);
const password = await hash("homeboard-demo");
const [home] = await sql<{ id: string }[]>`INSERT INTO households (name, timezone, fridge_pin_hash) VALUES ('The Johnson Home', 'America/Chicago', ${pin}) RETURNING id`;
const [parent] = await sql<{ id: string }[]>`INSERT INTO members (household_id, role, display_name, email, password_hash, color) VALUES (${home.id}, 'parent', 'Alex Johnson', 'parent@example.com', ${password}, '#312E81') RETURNING id`;
const children = await Promise.all([
  sql<{ id: string }[]>`INSERT INTO members (household_id, role, display_name, color) VALUES (${home.id}, 'child', 'Maya', '#D946EF') RETURNING id`,
  sql<{ id: string }[]>`INSERT INTO members (household_id, role, display_name, color) VALUES (${home.id}, 'child', 'Noah', '#0EA5E9') RETURNING id`,
  sql<{ id: string }[]>`INSERT INTO members (household_id, role, display_name, color) VALUES (${home.id}, 'child', 'Leo', '#F59E0B') RETURNING id`
]);
const childIds = children.map(([row]) => row.id);
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const [chore] = await sql<{ id: string }[]>`INSERT INTO chore_templates (household_id, title, instructions, assignment_policy, approval_required, schedule_kind, start_date, due_time) VALUES (${home.id}, 'Unload the dishwasher', 'Put everything away in its cabinet.', 'individual', false, 'daily', ${day}, '18:00') RETURNING id`;
await sql`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${chore.id}, ${childIds[0]})`;
const [shared] = await sql<{ id: string }[]>`INSERT INTO chore_templates (household_id, title, instructions, assignment_policy, approval_required, schedule_kind, start_date) VALUES (${home.id}, 'Feed the dog', 'Fill food and fresh water.', 'any', true, 'daily', ${day}) RETURNING id`;
for (const childId of childIds) await sql`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${shared.id}, ${childId})`;
const [routine] = await sql<{ id: string }[]>`INSERT INTO routine_templates (household_id, title, assignment_policy, schedule_kind, start_date) VALUES (${home.id}, 'After-school reset', 'any', 'weekdays', ${day}) RETURNING id`;
for (const childId of childIds) await sql`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${routine.id}, ${childId})`;
await sql`INSERT INTO routine_steps (routine_template_id, position, title) VALUES (${routine.id}, 1, 'Put backpack away'), (${routine.id}, 2, 'Place lunchbox by the sink'), (${routine.id}, 3, 'Finish homework check-in')`;
await sql`INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id) VALUES (${home.id}, ${parent.id}, 'household.seeded', 'household', ${home.id})`;
console.info("Seeded demo: parent@example.com / homeboard-demo; fridge PIN 1234");
await sql.end();
