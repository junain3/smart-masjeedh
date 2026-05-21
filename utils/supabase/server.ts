// utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 1. சாதாரண பயனர் லாகின் மற்றும் குக்கீஸ்களை நிர்வகிக்கும் பிரதான கிளையண்ட்
export function createClient() {
  const cookieStore = cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component-க்குள் இருந்து அழைக்கப்படும்போது இதைப் புறக்கணிக்கலாம்
          }
        },
      },
    }
  )
}

// 2. ChatGPT உருவாக்கிய, பாதுகாப்பு விதிகளை (RLS) கடந்து வேலை செய்யும் அட்மின் கிளையண்ட்
export const supabaseAdmin = createSupabaseJsClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)