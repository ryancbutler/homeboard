import { createClient, type Client, type Transaction } from "@libsql/client";
import postgres from "postgres";

export type DatabaseDialect = "postgres" | "sqlite";
type SqlFragment = { readonly text: string; readonly values: unknown[] };
type Sql = {
  <T = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  (values: Record<string, unknown>): SqlFragment;
  begin<T>(callback: (transaction: Sql) => Promise<T>): Promise<T>;
  unsafe(sql: string): Promise<unknown>;
  end(): Promise<void>;
};

// Helm deployments keep their existing PostgreSQL DATABASE_URL. A file: URL opts
// into SQLite, including the Compose default (file:/data/homeboard.db).
const url = process.env.DATABASE_URL ?? "postgres://missing:missing@127.0.0.1:5432/missing";
export const databaseDialect: DatabaseDialect = url.startsWith("file:") || url.startsWith("libsql:") ? "sqlite" : "postgres";

function sqliteValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function sqliteSql(sql: string): string {
  return sql
    .replaceAll("now()", "CURRENT_TIMESTAMP")
    // Keep the bound timezone argument so placeholder positions remain stable.
    // SQLite stores timestamps in UTC; its built-in date conversion is therefore UTC.
    .replace(/\(([^()]+) AT TIME ZONE \?\)::date/g, "date($1, CASE WHEN ? IS NOT NULL THEN 'utc' END)")
    .replace(/\(CURRENT_TIMESTAMP AT TIME ZONE \?\)::date/g, "date('now', CASE WHEN ? IS NOT NULL THEN 'utc' END)")
    .replace(/CURRENT_TIMESTAMP \+ interval '30 days'/g, "datetime('now', '+30 days')")
    .replace(/CURRENT_TIMESTAMP - \?::interval/g, "datetime('now', '-' || ?)")
    .replace(/CURRENT_TIMESTAMP \+ \?::interval/g, "datetime('now', '+' || ?)")
    .replace(/([\w.]+) > CURRENT_TIMESTAMP/g, "datetime($1) > CURRENT_TIMESTAMP")
    .replaceAll("::text", "")
    .replaceAll(" FOR UPDATE", "")
    .replace(/DELETE FROM chore_obligations o USING chore_occurrences c WHERE o\.occurrence_id = c\.id AND ([\s\S]*)$/g, "DELETE FROM chore_obligations WHERE id IN (SELECT o.id FROM chore_obligations o JOIN chore_occurrences c ON o.occurrence_id = c.id WHERE $1)")
    .replace(/UPDATE chore_obligations o SET([\s\S]*?)FROM chore_occurrences co WHERE o\.id = \? AND o\.occurrence_id = co\.id AND co\.household_id = \? AND o\.status = 'pending' RETURNING o\.id/g, "UPDATE chore_obligations SET$1WHERE id = ? AND occurrence_id IN (SELECT id FROM chore_occurrences WHERE household_id = ?) AND status = 'pending' RETURNING id")
    .replaceAll("'{}'", "'[]'");
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (key.endsWith("_at") && typeof value === "string") {
      const timestamp = value.replace(" ", "T");
      return [key, new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`)];
    }
    if (key === "weekdays" && typeof value === "string") {
      try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
    }
    return [key, value];
  })));
}

function makeSqliteSql(client: Client | Transaction): Sql {
  const sql = ((strings: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
    if (!Array.isArray(strings) || !("raw" in strings)) {
      const entries = Object.entries(strings);
      return { text: entries.map(([key]) => `\"${key}\" = ?`).join(", "), values: entries.map(([, value]) => value) } satisfies SqlFragment;
    }
    return (async <T = Record<string, unknown>[]>(): Promise<T> => {
    const args: unknown[] = [];
    let statement = strings[0];
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      const next = strings[index + 1];
      if (Array.isArray(value) && /ANY\($/i.test(statement) && /^\)/.test(next)) {
        statement = statement.replace(/=\s*ANY\($/i, value.length ? `IN (${value.map(() => "?").join(", ")}` : "IN (NULL)");
        args.push(...value.map(sqliteValue));
      } else if (typeof value === "object" && value && "text" in value && "values" in value) {
        const fragment = value as SqlFragment;
        statement += fragment.text;
        args.push(...fragment.values.map(sqliteValue));
      } else {
        statement += "?";
        args.push(sqliteValue(value));
      }
      statement += next;
    }
    const result = await client.execute({ sql: sqliteSql(statement), args: args as never });
    return normalizeRows(result.rows as Record<string, unknown>[]) as T;
    })();
  }) as Sql;
  sql.begin = async <T>(callback: (transaction: Sql) => Promise<T>) => {
    const transaction = "transaction" in client ? await client.transaction("write") : client;
    try {
      const result = await callback(makeSqliteSql(transaction));
      if ("commit" in transaction) await transaction.commit();
      return result;
    } catch (error) {
      if ("rollback" in transaction) await transaction.rollback();
      throw error;
    }
  };
  sql.unsafe = async (statement) => { await client.executeMultiple(sqliteSql(statement)); };
  sql.end = async () => { if ("close" in client) client.close(); };
  return sql;
}

function makePostgresSql(): Sql {
  const client = postgres(url, {
    types: { calendarDate: { to: 1082, from: [1082], serialize: (value: string) => value, parse: (value: string) => value } },
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10), idle_timeout: 20, connect_timeout: 10
  });
  return client as unknown as Sql;
}

export const db: Sql = databaseDialect === "sqlite" ? makeSqliteSql(createClient({ url })) : makePostgresSql();
export type Db = typeof db;
