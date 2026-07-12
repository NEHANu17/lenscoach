import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (!instance) {
    pool = new Pool({ connectionString: env.databaseUrl });
    instance = drizzle(pool, { schema: fullSchema });
  }
  return instance;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    instance = null;
  }
}
