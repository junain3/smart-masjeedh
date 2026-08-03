import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { UnifiedAppProvider } from "@/components/UnifiedAppProvider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
      { url: '/logo.png', sizes: '167x167', type: 'image/png' },
      { url: '/logo.png', sizes: '152x152', type: 'image/png' },
      { url: '/logo.png', sizes: '120x120', type: 'image/png' },
    ],
  },
};

export const viewport = {
  themeColor: '#065f46',
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/logo.png" sizes="512x512" />
        <link rel="shortcut icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="180x180" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="167x167" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="152x152" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="120x120" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-title" content="Smart Masjeedh" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} min-h-screen bg-neutral-50 text-neutral-900`}>
        <UnifiedAppProvider>
          <ToastProvider>{props.children}</ToastProvider>
        </UnifiedAppProvider>
      </body>
    </html>
  );
}
