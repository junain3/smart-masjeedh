import "./globals.css";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        {props.children}
      </body>
    </html>
  );
}
