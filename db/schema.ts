import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// ── Users: registered members ──
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  googleId: varchar("google_id", { length: 255 }),
  googleAvatar: text("google_avatar"),
  pwHash: varchar("pw_hash", { length: 255 }),
  memberNumber: integer("member_number").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── LUTs: color presets (admin-managed) ──
export const luts = pgTable("luts", {
  id: serial("id").primaryKey(),
  lutId: varchar("lut_id", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  tag: varchar("tag", { length: 255 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  gradient: text("gradient").notNull(),
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Lut = typeof luts.$inferSelect;
export type InsertLut = typeof luts.$inferInsert;

// ── Waitlist: early access signups ──
export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type InsertWaitlistEntry = typeof waitlist.$inferInsert;

// ── Hero Images: two carousel slides ──
export const heroImages = pgTable("hero_images", {
  id: serial("id").primaryKey(),
  slot: integer("slot").notNull(),
  imageUrl: text("image_url").notNull(),
  caption: varchar("caption", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HeroImage = typeof heroImages.$inferSelect;
export type InsertHeroImage = typeof heroImages.$inferInsert;
