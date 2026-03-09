import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('DEBUG SUPABASE INIT', {
  url: supabaseUrl,
  key_exists: !!supabaseAnonKey
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase environment variables are not set");
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

