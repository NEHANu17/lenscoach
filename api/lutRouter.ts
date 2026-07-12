import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { luts } from "@db/schema";
import { eq } from "drizzle-orm";
import { uploadBase64, deleteFile, BUCKETS } from "./lib/supabase";

export const lutRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(luts).orderBy(luts.id);
  }),

  getByLutId: publicQuery
    .input(z.object({ lutId: z.string() }))
    .query(async ({ input }) => {
      const [lut] = await getDb()
        .select()
        .from(luts)
        .where(eq(luts.lutId, input.lutId))
        .limit(1);
      return lut ?? null;
    }),

  create: publicQuery
    .input(
      z.object({
        lutId: z.string().min(1),
        name: z.string().min(1),
        tag: z.string().min(1),
        description: z.string().min(1),
        icon: z.string().min(1),
        gradient: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await getDb().insert(luts).values({
        lutId: input.lutId,
        name: input.name,
        tag: input.tag,
        description: input.description,
        icon: input.icon,
        gradient: input.gradient,
        updatedAt: new Date(),
      });
      const [created] = await getDb()
        .select()
        .from(luts)
        .where(eq(luts.lutId, input.lutId))
        .limit(1);
      return created;
    }),

  update: publicQuery
    .input(
      z.object({
        lutId: z.string(),
        name: z.string().optional(),
        tag: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        gradient: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { lutId, ...updates } = input;
      await getDb()
        .update(luts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(luts.lutId, lutId));
      const [updated] = await getDb()
        .select()
        .from(luts)
        .where(eq(luts.lutId, lutId))
        .limit(1);
      return updated;
    }),

  delete: publicQuery
    .input(z.object({ lutId: z.string() }))
    .mutation(async ({ input }) => {
      // Delete video from storage if exists
      const [lut] = await getDb()
        .select()
        .from(luts)
        .where(eq(luts.lutId, input.lutId))
        .limit(1);
      if (lut?.videoUrl) {
        try {
          await deleteFile(BUCKETS.videos, `${input.lutId}.mp4`);
        } catch { /* ignore */ }
      }
      await getDb().delete(luts).where(eq(luts.lutId, input.lutId));
      return { success: true };
    }),

  resetDefaults: publicQuery.mutation(async () => {
    // Delete all existing LUTs and their videos
    const allLuts = await getDb().select().from(luts);
    for (const lut of allLuts) {
      if (lut.videoUrl) {
        try { await deleteFile(BUCKETS.videos, `${lut.lutId}.mp4`); } catch { /* ignore */ }
      }
    }
    await getDb().delete(luts);

    // Insert defaults
    const defaults = [
      { lutId: "analog", name: "Analog Road Trip", tag: "Warm · Nostalgic", description: "The warm, slightly faded look of a road trip shot on old film. Golden tones, soft shadows, summer in every frame.", icon: "🎞️", gradient: "linear-gradient(135deg,#2a1800,#9a6828,#e8c878)" },
      { lutId: "tokyo", name: "Tokyonite", tag: "Neon · Cinematic", description: "Deep shadows, electric purples and pinks. The look of a city that never sleeps, shot at 2am in the rain.", icon: "🌸", gradient: "linear-gradient(135deg,#0a0520,#3a1060,#ff6b9d)" },
      { lutId: "y2k", name: "Y2K Mall Footage", tag: "Faded · Dreamy", description: "Washed-out blues and milky whites. The exact look of early 2000s disposable cameras and mall security footage.", icon: "📼", gradient: "linear-gradient(135deg,#c4d8e8,#78aac8,#a0c0d8)" },
      { lutId: "vhs", name: "VHS Summer", tag: "Grainy · Vintage", description: "Heavy grain, muted colors, that unmistakeable 90s home video warmth. Nostalgic before you even press play.", icon: "📹", gradient: "linear-gradient(135deg,#080820,#203050,#405870)" },
      { lutId: "golden", name: "Golden Hour", tag: "Warm · Glowing", description: "Rich ambers and honey tones. That 7pm light that makes everything look like a cinematic film still.", icon: "🌅", gradient: "linear-gradient(135deg,#100800,#8a4800,#ffe090)" },
      { lutId: "disney", name: "2000s Disney", tag: "Soft · Pastel", description: "Soft pinks, lifted blacks, a gentle dreamlike quality. The exact palette of early Disney Channel original movies.", icon: "✨", gradient: "linear-gradient(135deg,#ffd4e8,#ff88a8,#e06888)" },
    ];
    for (const lut of defaults) {
      await getDb().insert(luts).values({ ...lut, updatedAt: new Date() });
    }
    return getDb().select().from(luts).orderBy(luts.id);
  }),

  uploadVideo: publicQuery
    .input(
      z.object({
        lutId: z.string(),
        dataUrl: z.string().min(1),
        fileName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const ext = input.fileName.includes(".")
        ? input.fileName.split(".").pop() ?? "mp4"
        : "mp4";
      const path = `${input.lutId}.${ext}`;
      const contentType = ext === "mp4" ? "video/mp4" : `video/${ext}`;
      const publicUrl = await uploadBase64(
        BUCKETS.videos,
        path,
        input.dataUrl,
        contentType
      );
      await getDb()
        .update(luts)
        .set({ videoUrl: publicUrl, updatedAt: new Date() })
        .where(eq(luts.lutId, input.lutId));
      return { url: publicUrl };
    }),

  removeVideo: publicQuery
    .input(z.object({ lutId: z.string() }))
    .mutation(async ({ input }) => {
      const [lut] = await getDb()
        .select()
        .from(luts)
        .where(eq(luts.lutId, input.lutId))
        .limit(1);
      if (lut?.videoUrl) {
        const ext = lut.videoUrl.split(".").pop()?.split("?")[0] ?? "mp4";
        try {
          await deleteFile(BUCKETS.videos, `${input.lutId}.${ext}`);
        } catch { /* ignore */ }
      }
      await getDb()
        .update(luts)
        .set({ videoUrl: null, updatedAt: new Date() })
        .where(eq(luts.lutId, input.lutId));
      return { success: true };
    }),
});
