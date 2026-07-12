import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { waitlist } from "@db/schema";
import { eq, count } from "drizzle-orm";

export const waitlistRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(waitlist).orderBy(waitlist.createdAt);
  }),

  count: publicQuery.query(async () => {
    const [result] = await getDb().select({ value: count() }).from(waitlist);
    return result?.value ?? 0;
  }),

  signup: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const existing = await getDb()
        .select()
        .from(waitlist)
        .where(eq(waitlist.email, input.email))
        .limit(1);
      if (existing.length > 0) {
        return { success: false, message: "This email is already on the early access list." };
      }
      await getDb().insert(waitlist).values({ email: input.email });
      return { success: true, message: "Added to waitlist." };
    }),

  remove: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await getDb().delete(waitlist).where(eq(waitlist.email, input.email));
      return { success: true };
    }),
});
