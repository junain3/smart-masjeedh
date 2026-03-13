import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('DEBUG SUPABASE INIT', {
  url: supabaseUrl,
  key_exists: !!supabaseAnonKey,
  url_type: typeof supabaseUrl,
  key_type: typeof supabaseAnonKey
});

// Create a fallback client for development
const createFallbackClient = () => {
  console.warn("Creating fallback Supabase client - environment variables may be missing");
  return createClient(
    "https://libwvftwbrewcxigwoal.supabase.co", // Fallback URL
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYnd2ZnR3YnJld3d4aWd3b2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjU2ODUsImV4cCI6MjA4ODkwMTY4NX0.wOqjKxYhKvGhRnCp_9nJzPn4kWJQ7x9nJzPn4kWJQ7x", // Fallback key (this is just a placeholder)
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
};

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createFallbackClient();

