import "./globals.css";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-masjid-900 text-white">
        <div className="flex min-h-screen flex-col">
          <header className="flex h-14 items-center px-4 bg-masjid-800 border-b border-masjid-700">
            <span className="text-sm font-semibold tracking-wide">
              Smart Masjeedh
            </span>
          </header>
          <main className="flex-1 flex items-center justify-center px-4">
            {props.children}
          </main>
        </div>
      </body>
    </html>
  );
}
