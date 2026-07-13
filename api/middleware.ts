import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ZodError } from "zod";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Log the full error on the server
    console.error("[tRPC Error]", {
      message: error.message,
      code: error.code,
      cause: error.cause,
    });
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// Admin PIN check
const ADMIN_HASH = "f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2";

export const adminQuery = t.procedure.use(async ({ ctx, next }) => {
  const pin = ctx.req.headers.get("x-admin-pin");
  if (!pin) {
    throw new Error("Admin PIN required");
  }
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(pin).digest("hex");
  if (hash !== ADMIN_HASH) {
    throw new Error("Invalid admin PIN");
  }
  return next({ ctx });
});
