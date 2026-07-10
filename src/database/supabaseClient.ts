import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import logger from '../utils/logger';

let client: SupabaseClient;

export const getSupabaseClient = (): SupabaseClient => {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      );
    }

    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      // Electron's main process runs on Node, which (unlike a browser or
      // Node 22+) has no global WebSocket — supabase-js's realtime client
      // needs one unconditionally just to construct, even though this app
      // never opens a realtime channel.
      realtime: {
        transport: WebSocket as any,
      },
    });

    logger.info('Supabase client initialized');
  }

  return client;
};

export default getSupabaseClient();
