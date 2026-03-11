import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { CleanAuthProvider } from "@/components/CleanAuthProvider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-neutral-50 text-neutral-900`}>
        <CleanAuthProvider>
          <ToastProvider>{props.children}</ToastProvider>
        </CleanAuthProvider>
      </body>
    </html>
  );
}
