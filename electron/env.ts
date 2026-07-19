/**
 * Bootstrap module — must be the very first import in main.ts.
 *
 * Strategy:
 *  1. In dev (not packaged), load .env from the project root via dotenv.
 *  2. In production (packaged), the .env file doesn't exist — fall back to
 *     the values compiled in at build time so the app works out of the box.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { app } from 'electron';

if (!app.isPackaged) {
  // Dev: load from project root (.env is 3 levels up from dist/electron/electron/)
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

// Production fallbacks — these are compiled in at build time.
// They are only used when the corresponding env var is not already set.
process.env.SUPABASE_URL                = process.env.SUPABASE_URL                || 'https://inshfzdvglzwjybtpcal.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY   || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluc2hmemR2Z2x6d2p5YnRwY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyMDQ3MSwiZXhwIjoyMDk5MDk2NDcxfQ.BweL0T9TzC6stNcoGu2WT0HfrIVogeSWhc1tYtHk0qY';
process.env.SESSION_SECRET              = process.env.SESSION_SECRET              || 'a9f3e2c7b1d4082f6e5a3c9d7b2f1e8a4c6d0b3e7f2a5c8d1b4e9f3a6c2d5b8e1f4a7c0d3b6e9f2a5';
process.env.LOG_LEVEL                   = process.env.LOG_LEVEL                   || 'info';
process.env.BACKUP_PATH                 = process.env.BACKUP_PATH                 || './backups';
process.env.AUTO_BACKUP_ENABLED         = process.env.AUTO_BACKUP_ENABLED         || 'true';
process.env.AUTO_BACKUP_INTERVAL_HOURS  = process.env.AUTO_BACKUP_INTERVAL_HOURS  || '24';
process.env.CLOUDINARY_CLOUD_NAME       = process.env.CLOUDINARY_CLOUD_NAME       || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dxfbtmho2';
process.env.CLOUDINARY_API_KEY          = process.env.CLOUDINARY_API_KEY          || '365339785396535';
process.env.CLOUDINARY_API_SECRET       = process.env.CLOUDINARY_API_SECRET       || 'DGp1QYw3kqW2oT7mc4ciQYZSiMg';
// Web Push (VAPID) — must match NEXT_PUBLIC_VAPID_PUBLIC_KEY in Mens_space
process.env.VAPID_PUBLIC_KEY            = process.env.VAPID_PUBLIC_KEY            || 'BBH0i0fmgLroT_ZJt4O4y4ts3keVvVUvwgCSdebeZlmG0hA1c-D9AMtMTZG_1u1JrinX6YrmfN4grhWHp2vrwQ0';
process.env.VAPID_PRIVATE_KEY           = process.env.VAPID_PRIVATE_KEY           || 'w8PueOdmkKs8-Fwdrqs5Ne4DuvlsZ7HvwylBsOZGK8w';
process.env.VAPID_SUBJECT               = process.env.VAPID_SUBJECT               || 'mailto:admin@stockflow.pro';
