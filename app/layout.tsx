import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <ToastProvider>{props.children}</ToastProvider>
      </body>
    </html>
  );
}
