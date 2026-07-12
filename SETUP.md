# LensCoach — Supabase Backend Setup Guide

## What Changed

The app now uses **Supabase** as the backend database and storage:

- **Users** → Stored in Supabase PostgreSQL (synced across all devices)
- **LUTs** → Stored in Supabase PostgreSQL (admin-managed, editable)
- **Videos** → Stored in **Supabase Storage** (up to 50MB per video via IndexedDB)
- **Waitlist** → Stored in Supabase PostgreSQL (visible from all devices)
- **Hero Images** → Stored in **Supabase Storage** (admin-editable 2-slide carousel)
- **Admin Panel** → Now has 4 tabs: LUTs, Members, Waitlist, Hero Images

## Prerequisites

1. A Supabase account (free tier works): https://supabase.com
2. Your existing EmailJS credentials (for OTP emails)
3. Your existing Google OAuth Client ID

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose an organization and project name (e.g., "lenscoach")
4. Set a database password (save this!)
5. Choose a region close to your users
6. Wait for the project to be created (~2 minutes)

## Step 2: Get Your Supabase Credentials

### Project URL & Service Role Key
1. In your Supabase dashboard, go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy:
   - **Project URL** (e.g., `https://abcdefgh12345678.supabase.co`)
   - **service_role key** (under "Project API keys" — the secret one)

### Database Connection String
1. Go to **Project Settings > Database**
2. Under "Connection string", select **URI**
3. Copy the connection string and replace `[YOUR-PASSWORD]` with your database password
4. The format should be:
   ```
   postgresql://postgres:[PASSWORD]@db.abcdefgh12345678.supabase.co:5432/postgres
   ```

## Step 3: Create Storage Buckets

1. In the Supabase dashboard, go to **Storage**
2. Click **New bucket** and create:
   - `lut-videos` — for LUT preview videos
     - Set **Public bucket** to ON
   - `hero-images` — for hero carousel images
     - Set **Public bucket** to ON
3. For each bucket, go to **Policies** and add:
   - `INSERT` policy: `true` (allows uploads from your server)
   - `SELECT` policy: `true` (allows public reads)
   - `DELETE` policy: `true` (allows deletions from your server)

   Or use this SQL in the **SQL Editor**:
   ```sql
   -- Make buckets public
   insert into storage.buckets (id, name, public) values ('lut-videos', 'lut-videos', true);
   insert into storage.buckets (id, name, public) values ('hero-images', 'hero-images', true);

   -- Allow all operations
   create policy "Public Access" on storage.objects for select using (bucket_id in ('lut-videos', 'hero-images'));
   create policy "Public Upload" on storage.objects for insert with check (bucket_id in ('lut-videos', 'hero-images'));
   create policy "Public Delete" on storage.objects for delete using (bucket_id in ('lut-videos', 'hero-images'));
   ```

## Step 4: Update Environment Variables

Edit the `.env` file in the project root:

```env
# ── Supabase Configuration ──
SUPABASE_URL=https://your-actual-project-url.supabase.co
SUPABASE_SERVICE_KEY=your-actual-service-role-key

# PostgreSQL connection string (from Supabase Dashboard > Database)
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres

# Keep your existing credentials:
VITE_APP_ID=19f5118a-0882-8351-8000-00005fe64b48

# Google OAuth (keep your existing)
VITE_GOOGLE_CLIENT_ID=300645345570-1k4qessht86ctlkdilebejukdbvrdvgp.apps.googleusercontent.com

# EmailJS (keep your existing)
VITE_EMAILJS_SERVICE_ID=service_4killrb
VITE_EMAILJS_TEMPLATE_ID=template_4h600wr
VITE_EMAILJS_PUBLIC_KEY=CZINymvAbn-nRS707
```

## Step 5: Push Database Schema

Run this command to create all the tables in Supabase:

```bash
cd /mnt/agents/output/app
npm run db:push
```

This creates:
- `users` table — registered members
- `luts` table — color presets
- `waitlist` table — early access signups
- `hero_images` table — carousel images

## Step 6: Seed Default LUTs

The first time the admin panel is opened and unlocked, click **"↺ Reset Defaults"** to populate the 6 default LUTs. Alternatively, seed via the app UI.

## Step 7: Migrate Existing Data (Optional)

If you have existing users, waitlist entries, or videos in the browser's localStorage/IndexedDB from before the backend:

1. Open the deployed app in the same browser where the data exists
2. The app will automatically sync localStorage data to Supabase on first load
3. Videos from IndexedDB will be uploaded to Supabase Storage

## Step 8: Deploy

### Option A: Deploy Frontend Only (Static)
Build the frontend and deploy to any static host:

```bash
npm run build
# Deploy dist/public/ to your CDN/static host
```

### Option B: Full-Stack Deployment
You need a Node.js hosting provider (Render, Railway, Vercel, etc.):

1. Push code to GitHub
2. Connect to your hosting provider
3. Set environment variables (from `.env`)
4. Build command: `npm run build`
5. Start command: `npm start`
6. The server runs on port 3000 (or `$PORT`)

## Admin Panel PIN

The admin password is whatever produces this SHA-256 hash:
```
f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2
```

To change it, generate a new hash:
```bash
node -e "console.log(require('crypto').createHash('sha256').update('your-new-password').digest('hex'))"
```
Then update `ADMIN_HASH` in:
- `api/middleware.ts` (backend)
- `src/components/AdminPanel.tsx` (frontend)

## New Admin Features

### 1. Create LUT
- In the **LUTs** tab, click **"+ Create LUT"**
- Fill in: LUT ID, Name, Tag, Icon, Description, Gradient CSS
- Click **"Create LUT"**

### 2. Edit Hero Images
- Go to the **Hero Images** tab
- Upload new images for Slide 1 (Before/Left) and Slide 2 (After/Right)
- Images are stored in Supabase Storage and served via CDN
- If no images are uploaded, the gradient fallbacks are shown

### 3. Video Upload
- In the **LUTs** tab, click **"↑ Upload"** next to any LUT
- Videos up to **50MB** are supported (stored in Supabase Storage)
- Click **"🗑"** to remove a video

## Architecture

```
Frontend (React + Vite)
  ↓ tRPC (type-safe API)
Backend (Hono + tRPC)
  ↓ Drizzle ORM
PostgreSQL (Supabase)
  ↓
Supabase Storage (videos + images)
```

## Troubleshooting

**"Database connection refused"** → Check `DATABASE_URL` in `.env`
**"Storage bucket not found"** → Make sure you created the buckets in Step 3
**"CORS errors"** → Supabase handles CORS automatically for Storage
**Type errors?** → Run `npm run check` to diagnose
