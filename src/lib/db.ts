import postgres from "postgres";

// Next imports route modules while producing a build. Use an inert URL there; every
// actual deployment supplies DATABASE_URL and the first query fails clearly if it does not.
const url = process.env.DATABASE_URL ?? "postgres://missing:missing@127.0.0.1:5432/missing";

export const db = postgres(url, {
  // Calendar dates are YYYY-MM-DD values, not instants. The default driver
  // converts DATE to Date, which breaks one-time and weekly comparisons.
  types: {
    calendarDate: {
      to: 1082,
      from: [1082],
      serialize: (value: string) => value,
      parse: (value: string) => value,
    },
  },
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idle_timeout: 20,
  connect_timeout: 10
});

export type Db = typeof db;
