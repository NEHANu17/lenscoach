import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { heroImages } from "@db/schema";
import { eq } from "drizzle-orm";
import { uploadBase64, deleteFile, BUCKETS } from "./lib/supabase";

export const heroRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(heroImages).orderBy(heroImages.slot);
  }),

  update: publicQuery
    .input(
      z.object({
        slot: z.number().int().min(1).max(2),
        imageUrl: z.string().optional(),
        caption: z.string().optional(),
        base64Data: z.string().optional(), // If provided, upload to storage
      })
    )
    .mutation(async ({ input }) => {
      const { slot, base64Data, ...fields } = input;

      let imageUrl = fields.imageUrl;

      // Upload new image to Supabase Storage if base64 provided
      if (base64Data) {
        // Delete old image first
        const [existing] = await getDb()
          .select()
          .from(heroImages)
          .where(eq(heroImages.slot, slot))
          .limit(1);
        if (existing?.imageUrl) {
          const oldPath = `slide-${slot}.jpg`;
          try { await deleteFile(BUCKETS.heroImages, oldPath); } catch { /* ignore */ }
        }
        imageUrl = await uploadBase64(
          BUCKETS.heroImages,
          `slide-${slot}.jpg`,
          base64Data,
          "image/jpeg"
        );
      }

      const existing = await getDb()
        .select()
        .from(heroImages)
        .where(eq(heroImages.slot, slot))
        .limit(1);

      if (existing.length > 0) {
        await getDb()
          .update(heroImages)
          .set({
            ...(imageUrl ? { imageUrl } : {}),
            ...(fields.caption !== undefined ? { caption: fields.caption } : {}),
            updatedAt: new Date(),
          })
          .where(eq(heroImages.slot, slot));
      } else {
        await getDb().insert(heroImages).values({
          slot,
          imageUrl: imageUrl ?? "",
          caption: fields.caption,
          updatedAt: new Date(),
        });
      }

      const [updated] = await getDb()
        .select()
        .from(heroImages)
        .where(eq(heroImages.slot, slot))
        .limit(1);
      return updated;
    }),
});
