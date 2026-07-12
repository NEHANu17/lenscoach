import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-side Supabase client with service role key (admin access)
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Storage bucket names
export const BUCKETS = {
  videos: "lut-videos",
  heroImages: "hero-images",
} as const;

/**
 * Upload a base64 data URL to Supabase Storage
 * Returns the public URL of the uploaded file
 */
export async function uploadBase64(
  bucket: string,
  path: string,
  base64Data: string,
  contentType: string = "video/mp4"
): Promise<string> {
  // Extract the base64 content (remove data:...;base64, prefix)
  const base64Content = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const buffer = Buffer.from(base64Content, "base64");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
