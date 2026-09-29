import { describe, expect, it } from "vitest";
import { databaseIdSchema } from "@/lib/id-validation";

describe("database IDs", () => {
  it("accepts PostgreSQL UUIDs and SQLite hexadecimal IDs", () => {
    expect(databaseIdSchema.safeParse("9d29a3ad-fa12-60ed-6157-4d83587f191f").success).toBe(true);
    expect(databaseIdSchema.safeParse("9d29a3adfa1260ed61574d83587f191f").success).toBe(true);
    expect(databaseIdSchema.safeParse("not-an-id").success).toBe(false);
  });
});
