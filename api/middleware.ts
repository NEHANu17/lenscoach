import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// Admin PIN check — matches the hash in AdminPanel.tsx
const ADMIN_HASH = "f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2";

export const adminQuery = t.procedure.use(async ({ ctx, next }) => {
  // Admin endpoints require PIN passed in x-admin-pin header
  const pin = ctx.req.headers.get("x-admin-pin");
  if (!pin) {
    throw new Error("Admin PIN required");
  }
  // SHA-256 hash the PIN and compare
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(pin).digest("hex");
  if (hash !== ADMIN_HASH) {
    throw new Error("Invalid admin PIN");
  }
  return next({ ctx });
});
