import { z } from "zod";

// PostgreSQL uses UUIDs; the SQLite schema generates the same IDs without dashes.
export const databaseIdSchema = z.string().regex(/^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i);
