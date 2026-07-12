import { createRouter, publicQuery } from "./middleware";
import { userRouter } from "./userRouter";
import { lutRouter } from "./lutRouter";
import { waitlistRouter } from "./waitlistRouter";
import { heroRouter } from "./heroRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  user: userRouter,
  lut: lutRouter,
  waitlist: waitlistRouter,
  hero: heroRouter,
});

export type AppRouter = typeof appRouter;
