import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://umukegquehejfdsuftfy.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdWtlZ3F1ZWhlamZkc3VmdGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjg1NTUsImV4cCI6MjEwNzkwNDU1NX0.EN9kTNNVg5JWDV-qYiL6lndcAlPMor5hfeSn9_8jvDo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
