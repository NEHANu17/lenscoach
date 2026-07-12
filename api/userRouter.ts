import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq, count } from "drizzle-orm";

export const userRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(users).orderBy(users.createdAt);
  }),

  count: publicQuery.query(async () => {
    const [result] = await getDb().select({ value: count() }).from(users);
    return result?.value ?? 0;
  }),

  create: publicQuery
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        email: z.string().email(),
        googleId: z.string().optional(),
        googleAvatar: z.string().optional(),
        pwHash: z.string().optional(),
        memberNumber: z.number().int().positive(),
        verified: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getDb()
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existing.length > 0) {
        // Update existing user (e.g., Google linking)
        await getDb()
          .update(users)
          .set({
            firstName: input.firstName,
            lastName: input.lastName ?? existing[0].lastName,
            googleId: input.googleId ?? existing[0].googleId,
            googleAvatar: input.googleAvatar ?? existing[0].googleAvatar,
            pwHash: input.pwHash ?? existing[0].pwHash,
            verified: input.verified ?? existing[0].verified,
          })
          .where(eq(users.email, input.email));
        return existing[0];
      }
      await getDb().insert(users).values(input);
      const [created] = await getDb()
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      return created;
    }),

  remove: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await getDb().delete(users).where(eq(users.email, input.email));
      return { success: true };
    }),

  findByEmail: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const [user] = await getDb()
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      return user ?? null;
    }),
});
