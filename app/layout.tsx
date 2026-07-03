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

export const metadata = {
  title: 'Smart Masjeedh',
  description: 'Masjid Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smart Masjeedh',
  },
  icons: {
    icon: [
      { url: '/logo.png', sizes: '512x512' },
      { url: '/logo.png', sizes: '256x256' },
      { url: '/logo.png', sizes: '192x192' },
      { url: '/logo.png', sizes: '128x128' },
      { url: '/logo.png', sizes: '64x64' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180' },
      { url: '/logo.png', sizes: '167x167' },
      { url: '/logo.png', sizes: '152x152' },
      { url: '/logo.png', sizes: '120x120' },
    ],
  },
};

export const viewport = {
  themeColor: '#065f46',
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const userData = await getUserData();

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="180x180" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="167x167" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="152x152" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="120x120" />
        <link rel="apple-touch-startup-image" href="/logo.png" />
        <meta name="apple-mobile-web-app-title" content="Smart Masjeedh" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} min-h-screen bg-neutral-50 text-neutral-900`}>
        <MockAuthProvider>
          <ToastProvider>{props.children}</ToastProvider>
        </MockAuthProvider>
      </body>
    </html>
  );
}
