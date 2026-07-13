import { createRouter, publicQuery } from "./middleware";
import { userRouter } from "./userRouter";
import { lutRouter } from "./lutRouter";
import { waitlistRouter } from "./waitlistRouter";
import { heroRouter } from "./heroRouter";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { count } from "drizzle-orm";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  
  health: publicQuery.query(async () => {
    let dbStatus = "unknown";
    let dbError = "";
    let userCount = 0;

    try {
      const [result] = await getDb().select({ value: count() }).from(users);
      userCount = result?.value ?? 0;
      dbStatus = "connected";
    } catch (err: unknown) {
      dbStatus = "error";
      dbError = err instanceof Error ? err.message : String(err);
    }

    return {
      ok: true,
      time: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: !!process.env.DATABASE_URL,
        supabaseUrl: !!process.env.SUPABASE_URL,
      },
      db: {
        status: dbStatus,
        error: dbError,
        userCount,
      },
    };
  }),

  user: userRouter,
  lut: lutRouter,
  waitlist: waitlistRouter,
  hero: heroRouter,
});

export type AppRouter = typeof appRouter;
