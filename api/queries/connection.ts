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
    // Supabase requires SSL for external connections
    const connectionString = env.databaseUrl;
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase's SSL cert
      },
      max: 10, // Max connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout after 5s
    });

    // Log connection errors for debugging
    pool.on("error", (err) => {
      console.error("[DB Pool] Unexpected error:", err.message);
    });

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
