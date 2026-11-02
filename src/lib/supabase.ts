import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://umukegquehejfdsuftfy.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdWtlZ3F1ZWhlamZkc3VmdGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjg1NTUsImV4cCI6MjEwNzkwNDU1NX0.EN9kTNNVg5JWDV-qYiL6lndcAlPMor5hfeSn9_8jvDo';

export const SUPABASE_GOOGLE_CALLBACK_URL = `${SUPABASE_URL}/auth/v1/callback`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function fetchGoogleProviderStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.external?.google);
  } catch {
    return false;
  }
}
