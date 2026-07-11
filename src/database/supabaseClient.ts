import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import logger from '../utils/logger';

let client: SupabaseClient;

export const getSupabaseClient = (): SupabaseClient => {
  if (!client) {
    // Fall back to hardcoded values so the packaged app works without a .env file.
    const url = process.env.SUPABASE_URL ?? 'https://inshfzdvglzwjybtpcal.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluc2hmemR2Z2x6d2p5YnRwY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyMDQ3MSwiZXhwIjoyMDk5MDk2NDcxfQ.BweL0T9TzC6stNcoGu2WT0HfrIVogeSWhc1tYtHk0qY';

    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        transport: WebSocket as any,
      },
    });

    logger.info('Supabase client initialized');
  }

  return client;
};

export default getSupabaseClient();
