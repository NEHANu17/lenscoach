import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    console.error(`[ENV] Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  // These are from the Kimi auth template — not used by LensCoach but kept for compatibility
  appId: process.env.APP_ID ?? "",
  appSecret: process.env.APP_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),
};

// Log env status for debugging
if (env.isProduction) {
  console.log("[ENV] DATABASE_URL:", env.databaseUrl ? "✓ set" : "✗ MISSING");
  console.log("[ENV] SUPABASE_URL:", env.supabaseUrl ? "✓ set" : "✗ MISSING");
  console.log("[ENV] SUPABASE_SERVICE_KEY:", env.supabaseServiceKey ? "✓ set" : "✗ MISSING");
}
