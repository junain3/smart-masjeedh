import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { MockAuthProvider } from "@/components/MockAuthProvider";
import { Inter } from "next/font/google";
import { supabase } from '@/lib/supabase';

const inter = Inter({ subsets: ["latin"] });

async function getUserData() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { email: null, masjidId: null };
    }

    // Get user's masjid from user_roles
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('masjid_id')
      .eq('user_id', user.id)
      .single();

    return {
      email: user.email,
      masjidId: userRole?.masjid_id || null
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    return { email: null, masjidId: null };
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const userData = await getUserData();

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-neutral-50 text-neutral-900`}>
        <MockAuthProvider>
          <ToastProvider>{props.children}</ToastProvider>
        </MockAuthProvider>
      </body>
    </html>
  );
}
