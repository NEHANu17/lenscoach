import express from "express";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import path from "path";

// ── Setup ──
const app = express();
app.use(express.json({ limit: "50mb" }));

// ── Serve Frontend (production) ──
const publicDir = path.join(process.cwd(), "dist", "public");
app.use(express.static(publicDir));

// SPA fallback: serve index.html for all non-API routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-pin");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── Database ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 5000,
});

// ── Supabase Storage ──
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_HASH = "f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2";

// ── Auth helper ──
function checkAdminPin(req: express.Request): boolean {
  const pin = req.headers["x-admin-pin"] as string;
  if (!pin) return false;
  return createHash("sha256").update(pin).digest("hex") === ADMIN_HASH;
}

// ── Health ──
app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users");
    res.json({ ok: true, db: "connected", users: parseInt(result.rows[0].count) });
  } catch (e: unknown) {
    res.json({ ok: true, db: "error", error: e instanceof Error ? e.message : String(e) });
  }
});

// ── Users ──
app.get("/api/users", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at");
    res.json(result.rows);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/users/count", async (_req, res) => {
  const result = await pool.query("SELECT COUNT(*) FROM users");
  res.json({ count: parseInt(result.rows[0].count) });
});

app.post("/api/users", async (req, res) => {
  try {
    const { firstName, lastName, email, googleId, googleAvatar, pwHash, memberNumber, verified } = req.body;
    // Upsert
    await pool.query(
      `INSERT INTO users (first_name, last_name, email, google_id, google_avatar, pw_hash, member_number, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         google_id = COALESCE(EXCLUDED.google_id, users.google_id),
         google_avatar = COALESCE(EXCLUDED.google_avatar, users.google_avatar),
         pw_hash = COALESCE(EXCLUDED.pw_hash, users.pw_hash),
         verified = EXCLUDED.verified`,
      [firstName, lastName || null, email, googleId || null, googleAvatar || null, pwHash || null, memberNumber, verified ?? false]
    );
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    res.json(result.rows[0]);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.delete("/api/users", async (req, res) => {
  if (!checkAdminPin(req)) return res.status(403).json({ error: "Admin PIN required" });
  const { email } = req.body;
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  res.json({ success: true });
});

app.get("/api/users/find", async (req, res) => {
  const { email } = req.query;
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  res.json(result.rows[0] || null);
});

// ── LUTs ──
app.get("/api/luts", async (_req, res) => {
  const result = await pool.query("SELECT * FROM luts ORDER BY id");
  res.json(result.rows);
});

app.post("/api/luts", async (req, res) => {
  const { lutId, name, tag, description, icon, gradient } = req.body;
  await pool.query(
    "INSERT INTO luts (lut_id, name, tag, description, icon, gradient) VALUES ($1, $2, $3, $4, $5, $6)",
    [lutId, name, tag, description, icon, gradient]
  );
  const result = await pool.query("SELECT * FROM luts WHERE lut_id = $1", [lutId]);
  res.json(result.rows[0]);
});

app.patch("/api/luts", async (req, res) => {
  const { lutId, ...fields } = req.body;
  const setters: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      setters.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
  }
  if (setters.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(lutId);
  await pool.query(`UPDATE luts SET ${setters.join(", ")} WHERE lut_id = $${i}`, values);
  const result = await pool.query("SELECT * FROM luts WHERE lut_id = $1", [lutId]);
  res.json(result.rows[0]);
});

app.delete("/api/luts", async (req, res) => {
  if (!checkAdminPin(req)) return res.status(403).json({ error: "Admin PIN required" });
  const { lutId } = req.body;
  // Delete video from storage if exists
  const existing = await pool.query("SELECT video_url FROM luts WHERE lut_id = $1", [lutId]);
  if (existing.rows[0]?.video_url) {
    try { await supabase.storage.from("lut-videos").remove([`${lutId}.mp4`]); } catch { /* ignore */ }
  }
  await pool.query("DELETE FROM luts WHERE lut_id = $1", [lutId]);
  res.json({ success: true });
});

app.post("/api/luts/video", async (req, res) => {
  try {
    const { lutId, dataUrl, fileName } = req.body;
    const ext = fileName.includes(".") ? fileName.split(".").pop() : "mp4";
    const base64Content = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64Content, "base64");
    const { error } = await supabase.storage.from("lut-videos").upload(`${lutId}.${ext}`, buffer, {
      contentType: `video/${ext}`,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("lut-videos").getPublicUrl(`${lutId}.${ext}`);
    await pool.query("UPDATE luts SET video_url = $1, updated_at = NOW() WHERE lut_id = $2", [data.publicUrl, lutId]);
    res.json({ url: data.publicUrl });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.delete("/api/luts/video", async (req, res) => {
  const { lutId } = req.body;
  const existing = await pool.query("SELECT video_url FROM luts WHERE lut_id = $1", [lutId]);
  if (existing.rows[0]?.video_url) {
    const ext = existing.rows[0].video_url.split(".").pop()?.split("?")[0] ?? "mp4";
    try { await supabase.storage.from("lut-videos").remove([`${lutId}.${ext}`]); } catch { /* ignore */ }
  }
  await pool.query("UPDATE luts SET video_url = NULL, updated_at = NOW() WHERE lut_id = $1", [lutId]);
  res.json({ success: true });
});

// ── Waitlist ──
app.get("/api/waitlist", async (_req, res) => {
  const result = await pool.query("SELECT * FROM waitlist ORDER BY created_at");
  res.json(result.rows);
});

app.post("/api/waitlist", async (req, res) => {
  try {
    const { email } = req.body;
    await pool.query("INSERT INTO waitlist (email) VALUES ($1)", [email]);
    res.json({ success: true });
  } catch {
    res.json({ success: false, message: "This email is already on the early access list." });
  }
});

// ── Hero Images ──
app.get("/api/hero", async (_req, res) => {
  const result = await pool.query("SELECT * FROM hero_images ORDER BY slot");
  res.json(result.rows);
});

app.post("/api/hero", async (req, res) => {
  try {
    const { slot, base64Data } = req.body;
    // Upload to storage
    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(base64Content, "base64");
    const { error } = await supabase.storage.from("hero-images").upload(`slide-${slot}.jpg`, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("hero-images").getPublicUrl(`slide-${slot}.jpg`);
    
    // Upsert to DB
    await pool.query(
      `INSERT INTO hero_images (slot, image_url) VALUES ($1, $2)
       ON CONFLICT (slot) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()`,
      [slot, data.publicUrl]
    );
    res.json({ slot, imageUrl: data.publicUrl });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── Start ──
const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`[Server] Running on port ${port}`);
  console.log(`[Health] http://localhost:${port}/api/health`);
});
