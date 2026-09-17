import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type AccessContext = {
  householdId: string;
  memberId?: string;
  role: "parent" | "device";
};

const sessionCookie = "homeboard_session";
const deviceCookie = "homeboard_device";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const createToken = () => randomBytes(32).toString("base64url");
export const tokenDigest = hashToken;
// The package defaults to Argon2id, its recommended algorithm.
export const hashSecret = (secret: string) => hash(secret);
export const verifySecret = (secret: string, digest: string) => verify(digest, secret);

export async function contextFromCookies(): Promise<AccessContext | null> {
  const store = await cookies();
  const session = store.get(sessionCookie)?.value;
  if (session) {
    const rows = await db<{ household_id: string; member_id: string; role: "parent" }[]>`
      SELECT m.household_id, m.id AS member_id, m.role
      FROM sessions s JOIN members m ON m.id = s.member_id
      WHERE s.token_hash = ${hashToken(session)} AND s.expires_at > now() AND m.active = true`;
    if (rows[0]?.role === "parent") return { householdId: rows[0].household_id, memberId: rows[0].member_id, role: "parent" };
  }
  const device = store.get(deviceCookie)?.value;
  if (device) {
    const rows = await db<{ household_id: string }[]>`
      UPDATE display_devices SET last_seen_at = now()
      WHERE token_hash = ${hashToken(device)} AND revoked_at IS NULL
      RETURNING household_id`;
    if (rows[0]) return { householdId: rows[0].household_id, role: "device" };
  }
  if (process.env.ALLOW_DEMO === "true") {
    const rows = await db<{ household_id: string; member_id: string }[]>`
      SELECT h.id AS household_id, m.id AS member_id FROM households h
      JOIN members m ON m.household_id = h.id AND m.role = 'parent' AND m.active = true
      ORDER BY h.created_at, m.created_at LIMIT 1`;
    if (rows[0]) return { householdId: rows[0].household_id, memberId: rows[0].member_id, role: "parent" };
  }

  // Default display context for the household board so home devices don't require credentials
  const defaultHouseholds = await db<{ id: string }[]>`SELECT id FROM households ORDER BY created_at LIMIT 1`;
  if (defaultHouseholds[0]) return { householdId: defaultHouseholds[0].id, role: "device" };

  return null;
}

export async function requireContext(parent = false): Promise<AccessContext> {
  const context = await contextFromCookies();
  if (!context || (parent && context.role !== "parent")) throw new Error("Unauthorized");
  return context;
}

export async function setSession(memberId: string) {
  const token = createToken();
  await db`INSERT INTO sessions (member_id, token_hash, expires_at) VALUES (${memberId}, ${hashToken(token)}, now() + interval '30 days')`;
  const store = await cookies();
  store.set(sessionCookie, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession() {
  const store = await cookies();
  const session = store.get(sessionCookie)?.value;
  if (session) {
    await db`DELETE FROM sessions WHERE token_hash = ${hashToken(session)}`;
  }
  store.delete(sessionCookie);
}

export async function getPrimaryParent(householdId: string) {
  const rows = await db<{ id: string; display_name: string }[]>`
    SELECT id, display_name FROM members
    WHERE household_id = ${householdId} AND role = 'parent' AND active = true
    ORDER BY created_at LIMIT 1`;
  return rows[0] ?? null;
}

export async function verifyHouseholdPin(householdId: string, pin: string): Promise<boolean> {
  const rows = await db<{ fridge_pin_hash: string | null }[]>`
    SELECT fridge_pin_hash FROM households WHERE id = ${householdId}`;
  if (!rows[0]) return false;

  const initialPin = process.env.PARENT_PIN || process.env.INITIAL_PIN || "1234";

  if (!rows[0].fridge_pin_hash) {
    if (pin === initialPin) {
      const hashed = await hashSecret(initialPin);
      await db`UPDATE households SET fridge_pin_hash = ${hashed} WHERE id = ${householdId}`;
      return true;
    }
    return false;
  }

  try {
    return await verifySecret(pin, rows[0].fridge_pin_hash);
  } catch {
    return false;
  }
}

export async function updateHouseholdPin(householdId: string, newPin: string): Promise<void> {
  const hashed = await hashSecret(newPin);
  await db`UPDATE households SET fridge_pin_hash = ${hashed} WHERE id = ${householdId}`;
}
