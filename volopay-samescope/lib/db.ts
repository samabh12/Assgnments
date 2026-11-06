import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "", {
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
    // Neon and Supabase poolers do not support prepared statements.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
