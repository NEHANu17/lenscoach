import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

// CORS — allow all origins in production
app.use(cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-admin-pin"],
}));

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Health check (outside tRPC for simple monitoring)
app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      database: !!process.env.DATABASE_URL,
      supabase: !!process.env.SUPABASE_URL,
    },
  });
});

// tRPC handler
app.use("/api/trpc/*", async (c) => {
  try {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
  } catch (error) {
    console.error("[tRPC Error]", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`[Server] Running on http://localhost:${port}/`);
    console.log(`[Health] Check: http://localhost:${port}/api/health`);
  });
}
